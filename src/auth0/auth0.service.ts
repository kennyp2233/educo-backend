// src/auth0/auth0.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { UsuariosService } from '../users/users.service';

@Injectable()
export class Auth0Service {
  private readonly logger = new Logger(Auth0Service.name);
  private readonly apiUrl: string;
  private readonly domain: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private httpService: HttpService,
    private usuariosService: UsuariosService,
  ) {
    this.domain = this.configService.get<string>('AUTH0_DOMAIN');
    this.clientId = this.configService.get<string>('AUTH0_CLIENT_ID');
    this.clientSecret = this.configService.get<string>('AUTH0_CLIENT_SECRET');
    this.apiUrl = `https://${this.domain}/api/v2`;
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
          scope: 'read:users read:roles',
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
      const response = await firstValueFrom(
        this.httpService.post(`https://${this.domain}/oauth/token`, {
          grant_type: 'http://auth0.com/oauth/grant-type/password-realm',
          realm: 'Username-Password-Authentication',
          username: email,
          password,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'openid profile email offline_access',
          audience: `https://${this.domain}/userinfo`,
        })
      );

      const tokenData = response.data;
      const userInfo = await this.getUserInfo(tokenData.access_token);
      const roles = await this.getUserRoles(userInfo.sub);

      // Verificar si el usuario ya existe en nuestra base de datos
      let usuario = await this.prisma.usuario.findUnique({
        where: { auth0Id: userInfo.sub },
      });

      // Si no existe, lo creamos
      if (!usuario) {
        usuario = await this.usuariosService.crearUsuario(userInfo.sub);
      }

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
          userId: usuario.id,
        },
      };
    } catch (error) {
      this.logger.error(`Error en loginWithEmail: ${error.message}`);
      throw new Error(error.response?.data?.error_description || 'Error al iniciar sesión');
    }
  }

  /**
   * Obtiene información del usuario mediante su access_token
   */
  async getUserInfo(accessToken: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`https://${this.domain}/userinfo`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error al obtener información del usuario: ${error.message}`);
      throw new Error('Error al obtener información del usuario');
    }
  }

  /**
   * Obtiene los roles de un usuario.
   */
  async getUserRoles(userId: string): Promise<any[]> {
    try {
      const token = await this.getManagementApiToken();
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/users/${userId}/roles`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error al obtener roles del usuario: ${error.message}`);
      throw new Error('Error al obtener los roles del usuario');
    }
  }

  /**
   * Obtiene los roles disponibles en Auth0.
   */
  async getAvailableRoles(): Promise<any[]> {
    try {
      const token = await this.getManagementApiToken();
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/roles`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error al obtener roles disponibles: ${error.message}`);
      throw new Error('Error al obtener los roles disponibles');
    }
  }

  /**
   * Asigna un rol a un usuario.
   */
  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    try {
      const token = await this.getManagementApiToken();
      await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/users/${userId}/roles`,
          { roles: [roleId] },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }
        )
      );
    } catch (error) {
      this.logger.error(`Error al asignar rol al usuario: ${error.message}`);
      throw new Error('Error al asignar el rol al usuario');
    }
  }

  /**
   * Registra un nuevo usuario y asigna un rol.
   */
  async registerUser(email: string, password: string, role: string, fullName: string): Promise<any> {
    try {
      const token = await this.getManagementApiToken();
      const availableRoles = await this.getAvailableRoles();

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

      const createUserResponse = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/users`,
          {
            email,
            password,
            name: fullName,
            connection: 'Username-Password-Authentication',
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }
        )
      );

      const newUser = createUserResponse.data;
      await this.assignRoleToUser(newUser.user_id, targetRole.id);

      // Crear usuario en nuestra base de datos
      await this.usuariosService.crearUsuarioConRol(
        newUser.user_id,
        this.getRolIdFromName(role)
      );

      return newUser;
    } catch (error) {
      this.logger.error(`Error al registrar usuario: ${error.message}`);
      throw new Error(
        error.response?.data?.message || 'Error al registrar el usuario'
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

      return {
        access_token: response.data.access_token,
        id_token: response.data.id_token,
        refresh_token: response.data.refresh_token,
      };
    } catch (error) {
      this.logger.error(`Error al renovar token: ${error.message}`);
      throw new Error('Error al renovar el token');
    }
  }

  /**
   * Obtiene el ID del rol basado en su nombre.
   * Nota: Esta es una implementación básica, deberías adaptar esto
   * a tu estructura de base de datos real.
   */
  private getRolIdFromName(roleName: string): number {
    const roleMap = {
      'admin': 1,
      'padre': 2,
      'estudiante': 3,
      'profesor': 4,
      'tesorero': 5,
    };

    return roleMap[roleName.toLowerCase()] || 1; // Valor predeterminado si no se encuentra
  }
}