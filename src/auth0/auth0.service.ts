// src/auth0/auth0.service.ts

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { UsuariosService, Auth0UserData } from '../users/users.service';

@Injectable()
export class Auth0Service {
  private readonly logger = new Logger(Auth0Service.name);
  private readonly apiUrl: string;
  private readonly domain: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly mapeoRoles: { [key: string]: number } = {
    'admin': 1,
    'padre': 2,
    'estudiante': 3,
    'profesor': 4,
    'tesorero': 5,
  };

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

    // Inicializar mapeo de roles
    this.inicializarMapeoRoles();
  }

  /**
   * Inicializa el mapeo de roles auth0 a IDs locales
   */
  private async inicializarMapeoRoles(): Promise<void> {
    try {
      const roles = await this.usuariosService.obtenerRoles();
      roles.forEach(rol => {
        this.mapeoRoles[rol.nombre.toLowerCase()] = rol.id;
      });
    } catch (error) {
      this.logger.error('Error al inicializar mapeo de roles', error.stack);
    }
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

      // Sincronizar usuario con la base de datos local
      const userData: Auth0UserData = {
        auth0Id: userInfo.sub,
        email: userInfo.email,
        nombre: userInfo.name,
        fotoPerfil: userInfo.picture
      };

      // Buscar o crear usuario en la base de datos local
      let usuario = await this.usuariosService.buscarPorAuth0Id(userInfo.sub);

      if (!usuario) {
        // Si el usuario no existe localmente, lo creamos
        usuario = await this.usuariosService.crearUsuario(userInfo.sub);

        // Asignar roles en base de datos local
        if (roles && roles.length > 0) {
          for (const role of roles) {
            const rolId = await this.getRolIdFromName(role.name);
            if (rolId) {
              await this.usuariosService.asignarRol(usuario.id, rolId);
            }
          }
        }
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
   * Asigna un rol a un usuario en Auth0 y en la base de datos local
   */
  async assignRoleToUser(userId: string, roleId: string, roleName: string): Promise<void> {
    try {
      const token = await this.getManagementApiToken();

      // Asignar rol en Auth0
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

      // Sincronizar con la base de datos local
      const usuario = await this.usuariosService.buscarPorAuth0Id(userId);
      if (usuario) {
        const rolId = await this.getRolIdFromName(roleName);
        await this.usuariosService.asignarRol(usuario.id, rolId);
      } else {
        this.logger.warn(`No se pudo sincronizar rol para usuario ${userId}: Usuario no encontrado en BD local`);
      }
    } catch (error) {
      this.logger.error(`Error al asignar rol al usuario: ${error.message}`);
      throw new Error('Error al asignar el rol al usuario');
    }
  }

  /**
   * Registra un nuevo usuario y asigna un rol, sincronizando con la base de datos local.
   */
  async registerUser(email: string, password: string, role: string, fullName: string, perfilData?: any): Promise<any> {
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

      // 1. Crear usuario en Auth0
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

      // 2. Asignar rol en Auth0
      await this.assignRoleToUser(newUser.user_id, targetRole.id, targetRole.name);

      // 3. Crear usuario en nuestra base de datos con perfil completo
      let usuario;

      if (perfilData) {
        // Si se proporcionan datos de perfil, crear usuario completo con perfil
        usuario = await this.usuariosService.crearUsuarioCompleto(
          newUser.user_id,
          role,
          perfilData
        );
      } else {
        // Si no hay datos de perfil, crear usuario básico con rol
        const rolId = await this.getRolIdFromName(role);
        usuario = await this.usuariosService.crearUsuarioConRol(
          newUser.user_id,
          rolId
        );
      }

      return {
        auth0User: newUser,
        localUser: usuario
      };
    } catch (error) {
      this.logger.error(`Error al registrar usuario: ${error.message}`);

      // Si hay error, intentar limpiar el usuario en Auth0 si se creó
      // Esta sería una implementación más robusta para evitar inconsistencias

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
   * Sincroniza un usuario de Auth0 con la base de datos local
   */
  async sincronizarUsuario(auth0Id: string): Promise<any> {
    try {
      // 1. Obtener token de gestión
      const token = await this.getManagementApiToken();

      // 2. Obtener información del usuario desde Auth0
      const userResponse = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/users/${auth0Id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      );

      const userData = userResponse.data;

      // 3. Obtener roles del usuario
      const roles = await this.getUserRoles(auth0Id);

      // 4. Buscar o crear usuario en base de datos local
      let usuario = await this.usuariosService.buscarPorAuth0Id(auth0Id);

      if (!usuario) {
        // Si no existe, crear usuario
        usuario = await this.usuariosService.crearUsuario(auth0Id);
      }

      // 5. Sincronizar roles
      for (const role of roles) {
        const rolId = await this.getRolIdFromName(role.name);
        await this.usuariosService.asignarRol(usuario.id, rolId);
      }

      return {
        auth0User: userData,
        localUser: usuario
      };
    } catch (error) {
      this.logger.error(`Error al sincronizar usuario: ${error.message}`);
      throw new Error('Error al sincronizar usuario con la base de datos local');
    }
  }

  /**
   * Obtiene el ID del rol basado en su nombre.
   * Primero busca en la base de datos, si no lo encuentra usa el mapeo predefinido.
   */
  private async getRolIdFromName(roleName: string): Promise<number> {
    try {
      // Primero intentamos buscar el rol en la base de datos
      const rol = await this.usuariosService.obtenerRolPorNombre(roleName);
      if (rol) {
        return rol.id;
      }

      // Si no lo encontramos, usamos el mapeo
      return this.mapeoRoles[roleName.toLowerCase()] || 1;
    } catch (error) {
      this.logger.warn(`Error al buscar rol por nombre ${roleName}: ${error.message}`);
      return this.mapeoRoles[roleName.toLowerCase()] || 1;
    }
  }
}