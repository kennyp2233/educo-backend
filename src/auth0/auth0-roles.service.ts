// src/auth0/auth0-roles.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

export interface Auth0Role {
    id: string;
    name: string;
    description?: string;
}

@Injectable()
export class Auth0RolesService {
    private readonly logger = new Logger(Auth0RolesService.name);
    private readonly apiUrl: string;
    private readonly domain: string;
    private readonly clientId: string;
    private readonly clientSecret: string;

    // Mapeo de roles de Auth0 a roles locales
    private readonly roleMapping = {
        'admin': 'admin',
        'padre_familia': 'padre_familia',
        'padre': 'padre_familia',
        'estudiante': 'estudiante',
        'profesor': 'profesor',
        'tesorero': 'tesorero',
        'comite': 'comite',
        'institucion_educativa': 'institucion_educativa'
    };

    constructor(
        private configService: ConfigService,
        private httpService: HttpService,
        private prisma: PrismaService,
    ) {
        this.domain = this.configService.get<string>('AUTH0_DOMAIN');
        this.clientId = this.configService.get<string>('AUTH0_CLIENT_ID');
        this.clientSecret = this.configService.get<string>('AUTH0_CLIENT_SECRET');
        this.apiUrl = `https://${this.domain}/api/v2`;
    }

    /**
     * Obtiene el token de gestión de Auth0
     */
    async getManagementApiToken(): Promise<string> {
        try {
            this.logger.log(`Intentando obtener token de gestión con clientId: ${this.clientId.substring(0, 5)}... y domain: ${this.domain}`);

            const response = await firstValueFrom(
                this.httpService.post(`https://${this.domain}/oauth/token`, {
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    audience: `https://${this.domain}/api/v2/`,
                    grant_type: 'client_credentials',
                    scope: 'read:users read:roles',
                })
            );

            this.logger.log('Token de gestión obtenido correctamente');
            return response.data.access_token;
        } catch (error) {
            this.logger.error(`Error al obtener token de gestión: ${error.message}`);
            if (error.response) {
                this.logger.error(`Detalles del error: ${JSON.stringify(error.response.data)}`);
            }
            throw new Error('Error al obtener token de gestión: ' + (error.response?.data?.error_description || error.message));
        }
    }
    /**
     * Obtiene los roles disponibles en Auth0.
     */
    async getAvailableRoles(token?: string): Promise<Auth0Role[]> {
        try {
            if (!token) {
                token = await this.getManagementApiToken();
            }

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
     * Obtiene los roles de un usuario.
     */
    async getUserRoles(userId: string, token?: string): Promise<Auth0Role[]> {
        try {
            if (!token) {
                token = await this.getManagementApiToken();
            }

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
     * Asigna un rol a un usuario en Auth0
     */
    async assignRoleToUser(userId: string, roleId: string, token?: string): Promise<void> {
        try {
            if (!token) {
                token = await this.getManagementApiToken();
            }

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
     * Sincroniza los roles locales con los de Auth0
     */
    async syncLocalRoles(): Promise<void> {
        try {
            // Obtener los roles de Auth0
            const token = await this.getManagementApiToken();
            const auth0Roles = await this.getAvailableRoles(token);

            // Para cada rol en Auth0, verificar si existe en la base local
            for (const role of auth0Roles) {
                // Buscar o crear rol en la base de datos local
                await this.findOrCreateLocalRole(role.name);
            }

            this.logger.log('Roles sincronizados correctamente con Auth0');
        } catch (error) {
            this.logger.error(`Error al sincronizar roles locales: ${error.message}`);
            throw new Error('Error al sincronizar roles locales con Auth0');
        }
    }

    /**
     * Busca un rol por nombre en la BD local, y si no existe lo crea
     */
    async findOrCreateLocalRole(roleName: string): Promise<any> {
        try {
            // Normalizar el nombre del rol y aplicar mapeo si existe
            const normalizedName = roleName.toLowerCase();
            const mappedName = this.roleMapping[normalizedName] || normalizedName;

            // Buscar el rol en la base de datos
            let role = await this.prisma.rol.findFirst({
                where: {
                    nombre: {
                        contains: mappedName,
                        mode: 'insensitive'
                    }
                }
            });

            //  Si no existe, crearlo
            if (!role) {
                this.logger.log(`Creando nuevo rol local: ${mappedName}`);
                role = await this.prisma.rol.create({
                    data: {
                        nombre: mappedName
                    }
                });
            }

            return role;
        } catch (error) {
            this.logger.error(`Error al buscar o crear rol local ${roleName}: ${error.message}`);
            throw new Error(`Error al gestionar rol local ${roleName}`);
        }
    }

    /**
     * Mapea un rol de Auth0 a un ID de rol local
     */
    async mapAuth0RoleToLocalId(auth0RoleName: string): Promise<number> {
        try {
            const role = await this.findOrCreateLocalRole(auth0RoleName);
            return role.id;
        } catch (error) {
            this.logger.error(`Error al mapear rol de Auth0 a ID local: ${error.message}`);
            throw new Error(`Error al mapear rol ${auth0RoleName} a ID local`);
        }
    }

    /**
     * Obtiene los roles del usuario con su estado de aprobación
     */
    async getUserRolesWithApproval(userId: string): Promise<{ role: string, approved: boolean }[]> {
        const usuarioRoles = await this.prisma.usuarioRol.findMany({
            where: { usuarioId: userId },
            include: {
                rol: true
            }
        });

        return usuarioRoles.map(ur => ({
            role: ur.rol.nombre,
            approved: ur.estadoAprobacion === 'APROBADO'
        }));
    }

    /**
     * Verifica si un usuario tiene un determinado perfil creado
     */
    async verificarPerfilExistente(usuarioId: string, nombreRol: string): Promise<boolean> {
        try {
            const normalizedRole = nombreRol.toLowerCase();

            // Verificar según el tipo de rol
            if (['padre', 'padre_familia'].includes(normalizedRole)) {
                const padre = await this.prisma.padre.findUnique({
                    where: { usuarioId }
                });
                return !!padre;
            } else if (normalizedRole === 'estudiante') {
                const estudiante = await this.prisma.estudiante.findUnique({
                    where: { usuarioId }
                });
                return !!estudiante;
            } else if (normalizedRole === 'profesor') {
                const profesor = await this.prisma.profesor.findUnique({
                    where: { usuarioId }
                });
                return !!profesor;
            } else if (normalizedRole === 'tesorero') {
                const tesorero = await this.prisma.tesorero.findUnique({
                    where: { usuarioId }
                });
                return !!tesorero;
            }

            // Para roles que no requieren perfil específico
            return true;
        } catch (error) {
            this.logger.error(`Error al verificar perfil existente: ${error.message}`);
            return false;
        }
    }

    /**
     * Crear perfil básico para un usuario basado en su rol si no existe
     */
    async crearPerfilSiNoExiste(usuarioId: string, nombreRol: string): Promise<void> {
        try {
            // Verificar si ya existe el perfil
            const perfilExiste = await this.verificarPerfilExistente(usuarioId, nombreRol);
            if (perfilExiste) {
                return; // No hacer nada si ya existe
            }

            const normalizedRole = nombreRol.toLowerCase();

            // Crear perfil según el tipo de rol con datos mínimos
            if (['padre', 'padre_familia'].includes(normalizedRole)) {
                await this.prisma.padre.create({
                    data: {
                        usuarioId,
                        direccion: 'Por completar',
                        telefono: 'Por completar'
                    }
                });
                this.logger.log(`Perfil de padre creado para usuario ${usuarioId}`);
            } else if (normalizedRole === 'estudiante') {
                // Buscar curso por defecto o el primer curso disponible
                const primerCurso = await this.prisma.curso.findFirst();
                if (!primerCurso) {
                    this.logger.warn(`No se pudo crear perfil de estudiante para ${usuarioId}: No hay cursos disponibles`);
                    return;
                }

                await this.prisma.estudiante.create({
                    data: {
                        usuarioId,
                        cursoId: primerCurso.id,
                        grado: 'Por asignar'
                    }
                });
                this.logger.log(`Perfil de estudiante creado para usuario ${usuarioId}`);
            } else if (normalizedRole === 'profesor') {
                await this.prisma.profesor.create({
                    data: {
                        usuarioId,
                        especialidad: 'Por completar'
                    }
                });
                this.logger.log(`Perfil de profesor creado para usuario ${usuarioId}`);
            } else if (normalizedRole === 'tesorero') {
                // Buscar curso por defecto o el primer curso disponible
                const primerCurso = await this.prisma.curso.findFirst();
                if (!primerCurso) {
                    this.logger.warn(`No se pudo crear perfil de tesorero para ${usuarioId}: No hay cursos disponibles`);
                    return;
                }

                await this.prisma.tesorero.create({
                    data: {
                        usuarioId,
                        cursoId: primerCurso.id
                    }
                });
                this.logger.log(`Perfil de tesorero creado para usuario ${usuarioId}`);
            }
        } catch (error) {
            this.logger.error(`Error al crear perfil para usuario ${usuarioId} con rol ${nombreRol}: ${error.message}`);
            // No lanzar error para evitar interrumpir el flujo principal
        }
    }
}