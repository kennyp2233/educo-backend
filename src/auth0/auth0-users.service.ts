// src/auth0/auth0-users.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { Auth0RolesService } from './auth0-roles.service';

export interface Auth0UserProfile {
    sub: string;
    email: string;
    name: string;
    picture?: string;
    [key: string]: any;
}

export interface PerfilUsuarioData {
    tipo: string;
    datos: any;
}

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
    async getUserInfo(accessToken: string): Promise<Auth0UserProfile> {
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
            const token = await this.auth0RolesService.getManagementApiToken();

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
            throw new Error(`Error al crear usuario en Auth0: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Elimina un usuario de Auth0
     */
    async deleteUser(userId: string): Promise<void> {
        try {
            const token = await this.auth0RolesService.getManagementApiToken();

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
            return await this.prisma.$transaction(async (prisma) => {
                // Buscar o crear usuario en la base de datos local
                let usuario = await prisma.usuario.findUnique({
                    where: { auth0Id },
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

                if (!usuario) {
                    // Si no existe, crear usuario
                    usuario = await prisma.usuario.create({
                        data: { auth0Id },
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
                }

                // Sincronizar roles
                if (roles && roles.length > 0) {
                    const currentRoles = usuario.roles.map(r => ({
                        rolId: r.rolId,
                        rolNombre: r.rol.nombre.toLowerCase(),
                        estadoAprobacion: r.estadoAprobacion
                    }));

                    for (const role of roles) {
                        const roleName = typeof role === 'string' ? role : role.name;
                        // Obtener ID del rol local correspondiente
                        const rolId = await this.auth0RolesService.mapAuth0RoleToLocalId(roleName);
                        const rolExistente = currentRoles.find(r => r.rolId === rolId);

                        // Si no tiene este rol asignado, asignarlo con estado PENDIENTE
                        if (!rolExistente) {
                            // Verificar que el rol existe en la BD local
                            const rolExists = await prisma.rol.findUnique({ where: { id: rolId } });

                            if (!rolExists) {
                                this.logger.warn(`Rol con ID ${rolId} no existe en la BD local. Creando...`);
                                await prisma.rol.create({
                                    data: {
                                        nombre: roleName
                                    }
                                });
                            }

                            // Asignar rol al usuario con estado PENDIENTE
                            await prisma.usuarioRol.create({
                                data: {
                                    usuarioId: usuario.id,
                                    rolId: rolId,
                                    estadoAprobacion: 'PENDIENTE'
                                }
                            });

                            // Crear perfil básico si es necesario
                            await this.auth0RolesService.crearPerfilSiNoExiste(usuario.id, roleName);
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
                        },
                        padres: true,
                        estudiante: true,
                        profesor: true,
                        tesorero: true
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

                // 3. Asignar rol con estado PENDIENTE por defecto
                await prisma.usuarioRol.create({
                    data: {
                        usuarioId: usuario.id,
                        rolId,
                        estadoAprobacion: 'PENDIENTE'
                    }
                });

                // 4. Crear perfil según rol
                const normalizedRole = this.normalizeRoleName(roleName);

                // Si hay datos específicos de perfil, usarlos; de lo contrario, crear con datos por defecto
                if (perfilData) {
                    switch (normalizedRole) {
                        case 'padre_familia':
                        case 'padre':
                            await prisma.padre.create({
                                data: {
                                    usuarioId: usuario.id,
                                    direccion: perfilData.direccion || 'Por completar',
                                    telefono: perfilData.telefono || 'Por completar'
                                }
                            });
                            break;
                        case 'estudiante':
                            await prisma.estudiante.create({
                                data: {
                                    usuarioId: usuario.id,
                                    cursoId: perfilData.cursoId || (await this.obtenerPrimerCursoId()),
                                    grado: perfilData.grado || 'Por asignar'
                                }
                            });
                            break;
                        case 'profesor':
                            await prisma.profesor.create({
                                data: {
                                    usuarioId: usuario.id,
                                    especialidad: perfilData.especialidad || 'Por completar'
                                }
                            });
                            break;
                        case 'tesorero':
                            await prisma.tesorero.create({
                                data: {
                                    usuarioId: usuario.id,
                                    cursoId: perfilData.cursoId || (await this.obtenerPrimerCursoId())
                                }
                            });
                            break;
                        default:
                            // Para otros roles que no requieren perfil específico
                            break;
                    }
                } else {
                    // Si no hay datos específicos, crear perfil con datos por defecto
                    await this.auth0RolesService.crearPerfilSiNoExiste(usuario.id, roleName);
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
     * Obtiene el ID del primer curso disponible
     * @private
     */
    private async obtenerPrimerCursoId(): Promise<number> {
        const primerCurso = await this.prisma.curso.findFirst();
        if (!primerCurso) {
            throw new Error('No hay cursos disponibles en el sistema');
        }
        return primerCurso.id;
    }

    /**
     * Normaliza el nombre de un rol para procesar de manera uniforme
     * @private
     */
    private normalizeRoleName(roleName: string): string {
        const roleMapping = {
            'admin': 'admin',
            'padre_familia': 'padre_familia',
            'padre': 'padre_familia',
            'estudiante': 'estudiante',
            'profesor': 'profesor',
            'tesorero': 'tesorero',
            'comite': 'comite',
            'institucion_educativa': 'institucion_educativa'
        };

        const normalizedName = roleName.toLowerCase();
        return roleMapping[normalizedName] || normalizedName;
    }
}