// src/auth0/auth0.service.ts

import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Auth0RolesService } from './auth0-roles.service';
import { Auth0UsersService } from './auth0-users.service';
import { UsuariosService } from '../users/users.service';

// Interfaces para estandarizar la respuesta
export interface AuthTokens {
  access_token: string;
  id_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface UserInfo {
  sub: string;
  name: string;
  email: string;
  picture: string;
  roles: string[];
  userId: string;
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: UserInfo;
}

export interface UserProfile {
  auth0: {
    sub: string;
    name: string;
    email: string;
    picture?: string;
  };
  local: {
    id: string;
    roles: string[];
    perfil?: {
      tipo: string;
      datos: any;
    };
  };
}

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

      return this._formatAuthResponse(tokenData, userInfo, roles, localUser.id);
    } catch (error) {
      this.logger.error(`Error en loginWithEmail: ${error.message}`);
      throw new Error(error.response?.data?.error_description || 'Error al iniciar sesión');
    }
  }

  /**
   * Registra un nuevo usuario y asigna un rol
   * @returns Respuesta estandarizada con tokens y datos del usuario
   */
  async registerUser(
    email: string,
    password: string,
    role: string,
    fullName: string,
    perfilData?: any
  ): Promise<AuthResponse> {
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

      // 4. Sincronizar con la BD local
      const localUser = await this.auth0UsersService.createLocalUser(
        auth0User.user_id,
        role,
        perfilData
      );

      // 5. Iniciar sesión automáticamente para obtener tokens
      return await this.loginWithEmail(email, password);
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

      return this._formatAuthResponse(tokenData, userInfo, roles, localUser.id);
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

  /**
   * Obtiene el perfil completo del usuario (Auth0 + local)
   */
  async getUserProfile(token: string): Promise<UserProfile> {
    try {
      // 1. Obtener información del usuario desde Auth0
      const auth0Profile = await this.auth0UsersService.getUserInfo(token);

      // 2. Buscar usuario en la base de datos local con sus relaciones
      const localUser = await this.usuariosService.buscarPorAuth0Id(auth0Profile.sub, true);

      if (!localUser) {
        throw new NotFoundException('Usuario no encontrado en sistema local');
      }

      // 3. Obtener roles del usuario
      const roles = await this.usuariosService.obtenerRolesUsuario(localUser.id);

      // 4. Construir objeto de perfil
      const perfil: UserProfile = {
        auth0: {
          sub: auth0Profile.sub,
          name: auth0Profile.name,
          email: auth0Profile.email,
          picture: auth0Profile.picture
        },
        local: {
          id: localUser.id,
          roles: roles
        }
      };

      // 5. Añadir información de perfil específica si existe
      if (localUser.padres) {
        perfil.local.perfil = {
          tipo: 'padre',
          datos: localUser.padres
        };
      } else if (localUser.estudiante) {
        perfil.local.perfil = {
          tipo: 'estudiante',
          datos: localUser.estudiante
        };
      } else if (localUser.profesor) {
        perfil.local.perfil = {
          tipo: 'profesor',
          datos: localUser.profesor
        };
      } else if (localUser.tesorero) {
        perfil.local.perfil = {
          tipo: 'tesorero',
          datos: localUser.tesorero
        };
      }

      return perfil;
    } catch (error) {
      this.logger.error(`Error al obtener perfil de usuario: ${error.message}`);
      throw error;
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

  /**
   * Formatea la respuesta de autenticación para mantener consistencia
   * @private
   */
  private _formatAuthResponse(
    tokenData: any,
    userInfo: any,
    roles: any[],
    localUserId: string
  ): AuthResponse {
    return {
      tokens: {
        access_token: tokenData.access_token,
        id_token: tokenData.id_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in || 86400
      },
      user: {
        sub: userInfo.sub,
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture,
        roles: roles.map(role => typeof role === 'string' ? role : role.name),
        userId: localUserId,
      },
    };
  }
}