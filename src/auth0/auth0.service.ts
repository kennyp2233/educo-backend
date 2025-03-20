// src/auth0/services/auth0.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Auth0RolesService } from './auth0-roles.service';
import { Auth0UsersService } from './auth0-users.service';

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
   */
  async loginWithEmail(email: string, password: string): Promise<any> {
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
      return {
        tokens: {
          access_token: tokenData.access_token,
          id_token: tokenData.id_token,
          refresh_token: tokenData.refresh_token,
        },
        user: {
          sub: userInfo.sub,
          name: userInfo.name,
          email: userInfo.email,
          picture: userInfo.picture,
          roles: roles.map(role => role.name),
          userId: localUser.id,
        },
      };
    } catch (error) {
      this.logger.error(`Error en loginWithEmail: ${error.message}`);
      throw new Error(error.response?.data?.error_description || 'Error al iniciar sesión');
    }
  }

  /**
   * Registra un nuevo usuario y asigna un rol
   */
  async registerUser(email: string, password: string, role: string, fullName: string, perfilData?: any): Promise<any> {
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

      return {
        auth0User,
        localUser
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
   */
  async refreshAccessToken(refreshToken: string): Promise<any> {
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
      return {
        tokens: {
          access_token: tokenData.access_token,
          id_token: tokenData.id_token,
          refresh_token: tokenData.refresh_token,
        },
        user: {
          sub: userInfo.sub,
          name: userInfo.name,
          email: userInfo.email,
          picture: userInfo.picture,
          roles: roles.map(role => role.name),
          userId: localUser.id,
        },
      };
    } catch (error) {
      this.logger.error(`Error al renovar token: ${error.message}`);
      throw new Error('Error al renovar el token');
    }
  }

  /**
   * Obtiene todos los roles disponibles (delegado al servicio de roles)
   */
  async getAvailableRoles(): Promise<any[]> {
    return this.auth0RolesService.getAvailableRoles();
  }

  /**
   * Obtiene los roles de un usuario (delegado al servicio de roles)
   */
  async getUserRoles(userId: string): Promise<any[]> {
    return this.auth0RolesService.getUserRoles(userId);
  }

  /**
   * Obtiene la información de un usuario (delegado al servicio de usuarios)
   */
  async getUserProfile(userId: string, accessToken: string): Promise<any> {
    return this.auth0UsersService.getUserProfile(userId, accessToken);
  }
}