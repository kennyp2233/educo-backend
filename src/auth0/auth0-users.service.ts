// src/auth0/services/auth0-users.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { Auth0RolesService } from './auth0-roles.service';

@Injectable()
export class Auth0UsersService {
    private readonly logger = new Logger(Auth0UsersService.name);
    private readonly apiUrl: string;
    private readonly domain: string;

    constructor(
        private configService: ConfigService,
        private httpService: HttpService,
        private prisma: PrismaService,
        private auth0RolesService: Auth0RolesService,
    ) {
        this.domain = this.configService.get<string>('AUTH0_DOMAIN');
        this.apiUrl = `https://${this.domain}/api/v2`;
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
     * Crea un nuevo usuario en Auth0
     */
    async createUser(email: string, password: string, fullName: string): Promise<any> {
        try {
            const token = await this.getManagementApiToken();

            const response = await firstValueFrom(
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

            return response.data;
        } catch (error) {
            this.logger.error(`Error al crear usuario en Auth0: ${error.message}`);
            throw new Error('Error al crear usuario en Auth0');
        }
    }

    /**
     * Elimina un usuario de Auth0
     */
    async deleteUser(userId: string): Promise<void> {
        try {
            const token = await this.getManagementApiToken();

            await firstValueFrom(
                this.httpService.delete(`${this.apiUrl}/users/${userId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                })
            );

            this.logger.log(`Usuario Auth0 ${userId} eliminado`);
        } catch (error) {
            this.logger.error(`Error al eliminar usuario Auth0 ${userId}: ${error.message}`);
            throw new Error(`Error al eliminar usuario Auth0: ${error.message}`);
        }
    }

    /**
     * Sincroniza un usuario de Auth0 con la base de datos local
     */
    async syncUserWithDatabase(auth0Id: string, roles: any[]): Promise<any> {
        try {
            let usuario;
            return await this.prisma.$transaction(async (prisma) => {
                // Buscar o crear usuario en la base de datos local
                usuario = await prisma.usuario.findUnique({
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
                    usuario = await prisma.usuario.create({
                        data: { auth0Id }
                    });
                }
                // Sincronizar roles
                if (roles && roles.length > 0) {
                    const currentRoleIds = usuario.roles?.map(r => r.rolId) || [];
                    for (const role of roles) {
                        // Obtener ID del rol local correspondiente
                        const rolId = await this.auth0RolesService.mapAuth0RoleToLocalId(role.name);
                        // Verificar si ya tiene este rol asignado
                        if (!currentRoleIds.includes(rolId)) {
                            // Verificar que el rol existe en la BD local
                            const rolExists = await prisma.rol.findUnique({ where: { id: rolId } });

                            if (!rolExists) {
                                this.logger.warn(`Rol con ID ${rolId} no existe en la BD local. Creando...`);
                                await prisma.rol.create({
                                    data: {
                                        // id: rolId,
                                        nombre: role.name
                                    }
                                });
                            }

                            // Asignar rol al usuario
                            await prisma.usuarioRol.create({
                                data: {
                                    usuarioId: usuario.id,
                                    rolId: rolId
                                }
                            });
                        }
                    }
                }

                // Retornar usuario con sus roles actualizados
                return await prisma.usuario.findUnique({
                    where: { id: usuario.id },
                    include: {
                        roles: {
                            include: {
                                rol: true
                            }
                        }
                    }
                });
            });
        } catch (error) {
            this.logger.error(`Error al sincronizar usuario con BD local: ${error.message}`);
            throw new Error(`Error al sincronizar usuario: ${error.message}`);
        }
    }

    /**
     * Crea un usuario local con su perfil correspondiente
     */
    async createLocalUser(auth0Id: string, roleName: string, perfilData?: any): Promise<any> {
        try {
            return await this.prisma.$transaction(async (prisma) => {
                // 1. Buscar o crear el rol local correspondiente
                const rolId = await this.auth0RolesService.mapAuth0RoleToLocalId(roleName);

                // 2. Crear usuario base
                const usuario = await prisma.usuario.create({
                    data: { auth0Id }
                });

                // 3. Asignar rol
                await prisma.usuarioRol.create({
                    data: {
                        usuarioId: usuario.id,
                        rolId
                    }
                });

                // 4. Si hay datos de perfil, crear perfil según rol
                if (perfilData) {
                    switch (roleName.toLowerCase()) {
                        case 'padre_familia':
                        case 'padre':
                            await prisma.padre.create({
                                data: {
                                    usuarioId: usuario.id,
                                    direccion: perfilData.direccion,
                                    telefono: perfilData.telefono
                                }
                            });
                            break;
                        case 'estudiante':
                            await prisma.estudiante.create({
                                data: {
                                    usuarioId: usuario.id,
                                    cursoId: perfilData.cursoId,
                                    grado: perfilData.grado
                                }
                            });
                            break;
                        case 'profesor':
                            await prisma.profesor.create({
                                data: {
                                    usuarioId: usuario.id,
                                    especialidad: perfilData.especialidad
                                }
                            });
                            break;
                        case 'tesorero':
                            await prisma.tesorero.create({
                                data: {
                                    usuarioId: usuario.id,
                                    cursoId: perfilData.cursoId
                                }
                            });
                            break;
                    }
                }

                // Retornar usuario con roles
                return await prisma.usuario.findUnique({
                    where: { id: usuario.id },
                    include: {
                        roles: {
                            include: { rol: true }
                        },
                        padres: true,
                        estudiante: true,
                        profesor: true,
                        tesorero: true
                    }
                });
            });
        } catch (error) {
            const errorObj = new Error(`Error al crear usuario local: ${error.message}`);
            // Agregar propiedad auth0UserId para limpiar en caso de error
            errorObj['auth0UserId'] = auth0Id;
            throw errorObj;
        }
    }

    /**
     * Obtiene el token de gestión
     */
    private async getManagementApiToken(): Promise<string> {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`https://${this.domain}/oauth/token`, {
                    client_id: this.configService.get<string>('AUTH0_CLIENT_ID'),
                    client_secret: this.configService.get<string>('AUTH0_CLIENT_SECRET'),
                    audience: `https://${this.domain}/api/v2/`,
                    grant_type: 'client_credentials',
                    scope: 'read:users update:users create:users delete:users',
                })
            );

            return response.data.access_token;
        } catch (error) {
            this.logger.error(`Error al obtener token de gestión: ${error.message}`);
            throw new Error('Error al obtener token de gestión');
        }
    }

    async getUserProfile(userId: string, accessToken: string): Promise<any> {
        try {
            // 1. Obtener información del usuario desde Auth0
            const userInfo = await this.getUserInfo(accessToken);

            // 2. Obtener datos del usuario de la base de datos local
            const localUser = await this.prisma.usuario.findUnique({
                where: { auth0Id: userId },
                include: {
                    roles: {
                        include: {
                            rol: true
                        }
                    },
                    padres: true,
                    estudiante: {
                        include: {
                            curso: true
                        }
                    },
                    profesor: {
                        include: {
                            cursos: {
                                include: {
                                    curso: true
                                }
                            }
                        }
                    },
                    tesorero: {
                        include: {
                            curso: true
                        }
                    },
                    estadoAprobacion: true
                }
            });

            if (!localUser) {
                throw new Error('Usuario no encontrado en la base de datos local');
            }

            // 3. Obtener roles del usuario desde Auth0
            const userRoles = await this.auth0RolesService.getUserRoles(userId);

            // 4. Construir y retornar respuesta completa
            return {
                auth0: {
                    sub: userInfo.sub,
                    email: userInfo.email,
                    name: userInfo.name,
                    picture: userInfo.picture
                },
                local: {
                    id: localUser.id,
                    roles: localUser.roles.map(r => r.rol.nombre),
                    perfil: this.determinarPerfilUsuario(localUser),
                    estadoAprobacion: localUser.estadoAprobacion
                }
            };
        } catch (error) {
            this.logger.error(`Error al obtener perfil de usuario: ${error.message}`);
            throw new Error(`Error al obtener perfil: ${error.message}`);
        }
    }

    private determinarPerfilUsuario(usuario: any) {
        if (usuario.padres) {
            return {
                tipo: 'padre',
                datos: usuario.padres
            };
        }

        if (usuario.estudiante) {
            return {
                tipo: 'estudiante',
                datos: {
                    ...usuario.estudiante,
                    cursoNombre: usuario.estudiante.curso ?
                        `${usuario.estudiante.curso.nombre} ${usuario.estudiante.curso.paralelo}` : null
                }
            };
        }

        if (usuario.profesor) {
            return {
                tipo: 'profesor',
                datos: {
                    ...usuario.profesor,
                    cursos: usuario.profesor.cursos.map(c => ({
                        cursoId: c.cursoId,
                        esTutor: c.esTutor,
                        nombreCurso: c.curso ? `${c.curso.nombre} ${c.curso.paralelo}` : null
                    }))
                }
            };
        }

        if (usuario.tesorero) {
            return {
                tipo: 'tesorero',
                datos: {
                    ...usuario.tesorero,
                    cursoNombre: usuario.tesorero.curso ?
                        `${usuario.tesorero.curso.nombre} ${usuario.tesorero.curso.paralelo}` : null
                }
            };
        }

        return null;
    }
}