// src/auth0/auth0.service.ts

import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Auth0RolesService } from './auth0-roles.service';
import { Auth0UsersService } from './auth0-users.service';
import { UsuariosService } from '../users/users.service';
import {
  AuthResponse,
  RegisterResponse,
  UserProfile
} from './types/auth-response.types';

@Injectable()
export class Auth0Service {
  private readonly logger = new Logger(Auth0Service.name);
  private readonly domain: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly audience: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    private auth0RolesService: Auth0RolesService,
    private auth0UsersService: Auth0UsersService,
    private usuariosService: UsuariosService
  ) {
    this.domain = this.configService.get<string>('AUTH0_DOMAIN');
    this.clientId = this.configService.get<string>('AUTH0_CLIENT_ID');
    this.clientSecret = this.configService.get<string>('AUTH0_CLIENT_SECRET');
    this.audience = this.configService.get<string>('AUTH0_AUDIENCE');
  }

  /**
   * Obtiene el token de la API de gestión de Auth0.
   */
  async getManagementApiToken(): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`https://${this.domain}/oauth/token`, {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          audience: `https://${this.domain}/api/v2/`,
          grant_type: 'client_credentials',
          scope: 'read:users update:users create:users delete:users read:roles',
        })
      );

      return response.data.access_token;
    } catch (error) {
      this.logger.error(`Error al obtener token de gestión de Auth0: ${error.message}`);
      throw new Error('Error al obtener el token de gestión de Auth0');
    }
  }

  /**
   * Inicia sesión con email y contraseña.
   * @returns Respuesta estandarizada con tokens y datos del usuario
   */
  async loginWithEmail(email: string, password: string): Promise<AuthResponse> {
    try {
      // 1. Autenticación con Auth0
      const response = await firstValueFrom(
        this.httpService.post(`https://${this.domain}/oauth/token`, {
          grant_type: 'http://auth0.com/oauth/grant-type/password-realm',
          realm: 'Username-Password-Authentication',
          username: email,
          password,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'openid profile email offline_access',
          audience: this.audience || `https://${this.domain}/userinfo`,
        })
      );

      const tokenData = response.data;

      // 2. Obtener información del usuario y roles
      const userInfo = await this.auth0UsersService.getUserInfo(tokenData.access_token);
      const roles = await this.auth0RolesService.getUserRoles(userInfo.sub);

      // 3. Sincronizar usuario y roles con la base de datos local
      const localUser = await this.auth0UsersService.syncUserWithDatabase(userInfo.sub, roles);

      const rolesWithApproval = await this.auth0RolesService.getUserRolesWithApproval(localUser.id);

      // 4. Determinar tipo de perfil
      const userProfile = await this.determineUserProfile(localUser);

      // 5. Formatear respuesta estandarizada
      return {
        auth: {
          tokens: {
            access_token: tokenData.access_token,
            id_token: tokenData.id_token,
            refresh_token: tokenData.refresh_token,
            expires_in: tokenData.expires_in || 86400,
            token_type: tokenData.token_type || 'Bearer'
          }
        },
        user: {
          id: localUser.id,
          auth0Id: userInfo.sub,
          name: userInfo.name,
          email: userInfo.email,
          picture: userInfo.picture,
          roles: roles.map(role => typeof role === 'string' ? role : role.name),
          rolesApproved: rolesWithApproval,  // Nueva propiedad con roles y estado
          profile: userProfile
        }
      };
    } catch (error) {
      this.logger.error(`Error en loginWithEmail: ${error.message}`);
      throw new Error(error.response?.data?.error_description || 'Error al iniciar sesión');
    }
  }

  async registerUser(
    email: string,
    password: string,
    role: string,
    fullName: string,
    perfilData?: any
  ): Promise<RegisterResponse> {
    try {
      // 1. Validar rol
      const availableRoles = await this.auth0RolesService.getAvailableRoles();
      const targetRole = availableRoles.find(
        (r) => r.name.toLowerCase() === role.toLowerCase()
      );

      if (!targetRole) {
        throw new Error(
          `El rol '${role}' no es válido. Roles disponibles: ${availableRoles
            .map((r) => r.name)
            .join(', ')}`
        );
      }

      // 2. Crear usuario en Auth0
      const auth0User = await this.auth0UsersService.createUser(email, password, fullName);

      // 3. Asignar rol en Auth0
      await this.auth0RolesService.assignRoleToUser(auth0User.user_id, targetRole.id);

      // 4. Sincronizar con la BD local y crear perfil según rol
      const localUser = await this.auth0UsersService.createLocalUser(
        auth0User.user_id,
        role,
        perfilData
      );

      // 5. Iniciar sesión automáticamente para obtener tokens
      const authResponse = await this.loginWithEmail(email, password);

      return {
        success: true,
        message: 'Usuario registrado correctamente',
        auth: authResponse.auth,
        user: authResponse.user
      };
    } catch (error) {
      this.logger.error(`Error al registrar usuario: ${error.message}`);

      // Si hay error con el usuario ya creado, intentar limpiarlo
      if (error.auth0UserId) {
        try {
          await this.auth0UsersService.deleteUser(error.auth0UserId);
        } catch (cleanupError) {
          this.logger.error(`Error al limpiar usuario Auth0 creado: ${cleanupError.message}`);
        }
      }

      throw new Error(
        error.response?.data?.message || error.message || 'Error al registrar el usuario'
      );
    }
  }

  /**
   * Renueva el access_token usando el refresh_token.
   * @returns Respuesta estandarizada con tokens y datos del usuario
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`https://${this.domain}/oauth/token`, {
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
        })
      );

      const tokenData = response.data;

      // Obtener información del usuario usando el nuevo access_token
      const userInfo = await this.auth0UsersService.getUserInfo(tokenData.access_token);
      const roles = await this.auth0RolesService.getUserRoles(userInfo.sub);
      const localUser = await this.auth0UsersService.syncUserWithDatabase(userInfo.sub, roles);
      const rolesWithApproval = await this.auth0RolesService.getUserRolesWithApproval(localUser.id);

      // Determinar tipo de perfil
      const userProfile = await this.determineUserProfile(localUser);

      return {
        auth: {
          tokens: {
            access_token: tokenData.access_token,
            id_token: tokenData.id_token,
            refresh_token: tokenData.refresh_token,
            expires_in: tokenData.expires_in || 86400,
            token_type: tokenData.token_type || 'Bearer'
          }
        },
        user: {
          id: localUser.id,
          auth0Id: userInfo.sub,
          name: userInfo.name,
          email: userInfo.email,
          picture: userInfo.picture,
          roles: roles.map(role => typeof role === 'string' ? role : role.name),
          rolesApproved: rolesWithApproval,  // Nueva propiedad con roles y estado
          profile: userProfile
        }
      };
    } catch (error) {
      this.logger.error(`Error al renovar token: ${error.message}`);
      throw new Error('Error al renovar el token');
    }
  }

  /**
   * Obtiene todos los roles disponibles
   */
  async getAvailableRoles(): Promise<any[]> {
    return this.auth0RolesService.getAvailableRoles();
  }

  /**
   * Obtiene los roles de un usuario
   */
  async getUserRoles(userId: string): Promise<any[]> {
    return this.auth0RolesService.getUserRoles(userId);
  }

  async getUserProfile(token: string): Promise<AuthResponse> {
    try {
      // 1. Obtener información del usuario desde Auth0
      const auth0Profile = await this.auth0UsersService.getUserInfo(token);

      // 2. Buscar usuario en la base de datos local con sus relaciones
      const localUser = await this.usuariosService.buscarPorAuth0Id(auth0Profile.sub, true);

      if (!localUser) {
        throw new NotFoundException('Usuario no encontrado en sistema local');
      }

      // 3. Obtener roles del usuario con estado de aprobación
      const rolesWithApproval = await this.auth0RolesService.getUserRolesWithApproval(localUser.id);

      // 4. Determinar tipo de perfil
      const userProfile = await this.determineUserProfile(localUser);

      // 5. Construir respuesta estandarizada
      return {
        user: {
          id: localUser.id,
          auth0Id: auth0Profile.sub,
          name: auth0Profile.name,
          email: auth0Profile.email,
          picture: auth0Profile.picture,
          roles: rolesWithApproval.map(r => r.role),
          rolesApproved: rolesWithApproval,  // Nueva propiedad con roles y estado
          profile: userProfile
        }
      };
    } catch (error) {
      this.logger.error(`Error al obtener perfil de usuario: ${error.message}`);
      throw error;
    }
  }

  /**
   * Determina el tipo de perfil del usuario basado en sus datos locales
   * @private
   */
  private async determineUserProfile(localUser: any): Promise<UserProfile> {
    if (localUser.padres) {
      return {
        type: 'padre',
        data: localUser.padres
      };
    } else if (localUser.estudiante) {
      return {
        type: 'estudiante',
        data: localUser.estudiante
      };
    } else if (localUser.profesor) {
      return {
        type: 'profesor',
        data: localUser.profesor
      };
    } else if (localUser.tesorero) {
      return {
        type: 'tesorero',
        data: localUser.tesorero
      };
    } else {
      // Verificar si tiene rol de admin
      const roles = await this.usuariosService.obtenerRolesUsuario(localUser.id);
      if (roles.some(r => r.toLowerCase() === 'admin')) {
        return { type: 'admin' };
      }

      return { type: 'none' };
    }
  }

  /**
   * Obtiene el ID de usuario local a partir del ID de Auth0
   */
  async getUserIdFromAuth0(auth0Id: string): Promise<string> {
    const usuario = await this.usuariosService.buscarPorAuth0Id(auth0Id);

    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado en el sistema local');
    }

    return usuario.id;
  }


}