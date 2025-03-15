// src/auth0/auth0.service.ts - Versión mejorada con transacciones Prisma

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
    'padre_familia': 2,
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
   * Mejorado con transacciones para garantizar coherencia entre Auth0 y la base de datos local
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
          audience: `https://${this.domain}/userinfo`,
        })
      );

      const tokenData = response.data;

      // 2. Obtener información del usuario y roles
      const userInfo = await this.getUserInfo(tokenData.access_token);
      const roles = await this.getUserRoles(userInfo.sub);
      console.log('Roles:', roles);
      // 3. Ejecutar la sincronización dentro de una transacción
      return await this.prisma.executeTransaction(async (prisma) => {
        // Buscar o crear usuario en la base de datos local
        let usuario = await prisma.usuario.findUnique({
          where: { auth0Id: userInfo.sub },
          include: {
            roles: {
              include: {
                rol: true
              }
            }
          }
        });

        if (!usuario) {
          // Si el usuario no existe localmente, lo creamos
          let usuario = await prisma.usuario.create({
            data: { auth0Id: userInfo.sub }
          });

          // Asignar roles en base de datos local
          if (roles && roles.length > 0) {
            for (const role of roles) {
              const rolId = await this.getRolIdFromName(role.name);
              if (rolId) {
                await prisma.usuarioRol.create({
                  data: {
                    usuarioId: usuario.id,
                    rolId: rolId
                  }
                });
              }
            }
          }
        } else {
          // Verificar si hay roles nuevos para asignar
          const rolesActuales = usuario.roles.map(r => r.rol.nombre.toLowerCase());
          for (const role of roles) {
            const rolId = await this.getRolIdFromName(role.name);
            if (rolId && !rolesActuales.includes(role.name.toLowerCase())) {
              await prisma.usuarioRol.create({
                data: {
                  usuarioId: usuario.id,
                  rolId: rolId
                }
              });
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
      });
    } catch (error) {
      this.logger.error(`Error en loginWithEmail: ${error.message}`);
      throw new Error(error.response?.data?.error_description || 'Error al iniciar sesión');
    }
  }

  /**
   * Registra un nuevo usuario y asigna un rol, sincronizando con la base de datos local.
   * Mejorado con transacciones para garantizar consistencia entre Auth0 y base de datos local
   */
  async registerUser(email: string, password: string, role: string, fullName: string, perfilData?: any): Promise<any> {
    let auth0UserId = null;

    try {
      // 1. Obtener token y validar rol
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

      // 2. Crear usuario en Auth0
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
      auth0UserId = newUser.user_id;

      // 3. Ejecutar el resto del proceso en una transacción
      return await this.prisma.executeTransaction(async (prisma) => {
        let usuario;

        // 3.1. Asignar rol en Auth0
        await firstValueFrom(
          this.httpService.post(
            `${this.apiUrl}/users/${auth0UserId}/roles`,
            { roles: [targetRole.id] },
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            }
          )
        );

        // 3.2. Crear usuario en nuestra base de datos
        if (perfilData) {
          // Si se proporcionan datos de perfil, crear con datos completos en la transacción
          // Primero, crear el usuario base
          const rolId = await this.getRolIdFromName(role);

          const usuarioBase = await prisma.usuario.create({
            data: {
              auth0Id: auth0UserId
            }
          });

          // Asignar rol
          await prisma.usuarioRol.create({
            data: {
              usuarioId: usuarioBase.id,
              rolId
            }
          });

          // Crear perfil según el rol
          switch (role.toLowerCase()) {
            case 'padre':
              await prisma.padre.create({
                data: {
                  usuarioId: usuarioBase.id,
                  direccion: perfilData.direccion,
                  telefono: perfilData.telefono
                }
              });
              break;
            case 'estudiante':
              await prisma.estudiante.create({
                data: {
                  usuarioId: usuarioBase.id,
                  cursoId: perfilData.cursoId,
                  grado: perfilData.grado
                }
              });
              break;
            case 'profesor':
              await prisma.profesor.create({
                data: {
                  usuarioId: usuarioBase.id,
                  especialidad: perfilData.especialidad
                }
              });
              break;
            case 'tesorero':
              await prisma.tesorero.create({
                data: {
                  usuarioId: usuarioBase.id,
                  cursoId: perfilData.cursoId
                }
              });
              break;
          }

          // Obtener usuario con sus relaciones para devolver
          usuario = await prisma.usuario.findUnique({
            where: { id: usuarioBase.id },
            include: {
              roles: {
                include: {
                  rol: true
                }
              },
              padres: true,
              estudiante: true,
              profesor: true,
              tesorero: true
            }
          });
        } else {
          // Si no hay datos de perfil, crear usuario básico con rol
          const rolId = await this.getRolIdFromName(role);

          const usuarioBase = await prisma.usuario.create({
            data: {
              auth0Id: auth0UserId
            }
          });

          await prisma.usuarioRol.create({
            data: {
              usuarioId: usuarioBase.id,
              rolId
            }
          });

          usuario = await prisma.usuario.findUnique({
            where: { id: usuarioBase.id },
            include: {
              roles: {
                include: {
                  rol: true
                }
              }
            }
          });
        }

        return {
          auth0User: newUser,
          localUser: usuario
        };
      });
    } catch (error) {
      this.logger.error(`Error al registrar usuario: ${error.message}`);

      // Si hay error y hemos creado el usuario en Auth0, intentar limpiarlo
      if (auth0UserId) {
        try {
          const cleanupToken = await this.getManagementApiToken();
          await firstValueFrom(
            this.httpService.delete(`${this.apiUrl}/users/${auth0UserId}`, {
              headers: {
                Authorization: `Bearer ${cleanupToken}`,
              },
            })
          );
          this.logger.log(`Usuario Auth0 ${auth0UserId} eliminado tras error`);
        } catch (cleanupError) {
          this.logger.error(`Error al limpiar usuario Auth0 creado: ${cleanupError.message}`);
        }
      }

      throw new Error(
        error.response?.data?.message || 'Error al registrar el usuario'
      );
    }
  }

  /**
   * Asigna un rol a un usuario en Auth0 y en la base de datos local
   * Mejorado con transacciones para garantizar consistencia entre Auth0 y la BD local
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

      // Sincronizar con la base de datos local en una transacción
      await this.prisma.executeTransaction(async (prisma) => {
        const usuario = await prisma.usuario.findUnique({
          where: { auth0Id: userId }
        });

        if (!usuario) {
          this.logger.warn(`No se pudo sincronizar rol para usuario ${userId}: Usuario no encontrado en BD local`);
          return;
        }

        const rolId = await this.getRolIdFromName(roleName);

        // Verificar si ya tiene el rol asignado
        const rolExistente = await prisma.usuarioRol.findUnique({
          where: {
            usuarioId_rolId: {
              usuarioId: usuario.id,
              rolId
            }
          }
        });

        if (!rolExistente) {
          await prisma.usuarioRol.create({
            data: {
              usuarioId: usuario.id,
              rolId
            }
          });
        }
      });
    } catch (error) {
      this.logger.error(`Error al asignar rol al usuario: ${error.message}`);
      throw new Error('Error al asignar el rol al usuario');
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
   * Mejorado con transacciones para garantizar consistencia
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

      // 4. Sincronizar en una transacción
      return await this.prisma.executeTransaction(async (prisma) => {
        // Buscar o crear usuario en base de datos local
        let usuario = await prisma.usuario.findUnique({
          where: { auth0Id },
          include: {
            roles: {
              include: {
                rol: true
              }
            }
          }
        });

        if (!usuario) {
          // Si no existe, crear usuario
          let usuario = await prisma.usuario.create({
            data: { auth0Id }
          });
        }

        // Sincronizar roles
        const rolesActuales = usuario.roles.map(r => r.rol.nombre.toLowerCase());

        for (const role of roles) {
          const rolId = await this.getRolIdFromName(role.name);

          // Verificar si ya tiene este rol
          if (!rolesActuales.includes(role.name.toLowerCase())) {
            await prisma.usuarioRol.create({
              data: {
                usuarioId: usuario.id,
                rolId
              }
            });
          }
        }

        // Obtener el usuario actualizado con sus relaciones
        const usuarioActualizado = await prisma.usuario.findUnique({
          where: { id: usuario.id },
          include: {
            roles: {
              include: {
                rol: true
              }
            },
            padres: true,
            estudiante: true,
            profesor: true,
            tesorero: true
          }
        });

        return {
          auth0User: userData,
          localUser: usuarioActualizado
        };
      });
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