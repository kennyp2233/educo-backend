// src/auth0/services/auth0-roles.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class Auth0RolesService {
    private readonly logger = new Logger(Auth0RolesService.name);
    private readonly apiUrl: string;
    private readonly domain: string;

    constructor(
        private configService: ConfigService,
        private httpService: HttpService,
        private prisma: PrismaService,
    ) {
        this.domain = this.configService.get<string>('AUTH0_DOMAIN');
        this.apiUrl = `https://${this.domain}/api/v2`;
    }

    /**
     * Obtiene los roles disponibles en Auth0.
     */
    async getAvailableRoles(token?: string): Promise<any[]> {
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
    async getUserRoles(userId: string, token?: string): Promise<any[]> {
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
            // Mapeo de roles de Auth0 a roles locales
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

            // Normalizar el nombre del rol y aplicar mapeo si existe
            const normalizedName = roleName.toLowerCase();
            const mappedName = roleMapping[normalizedName] || normalizedName;

            // Buscar el rol en la base de datos
            let role = await this.prisma.rol.findFirst({
                where: {
                    nombre: {
                        contains: mappedName,
                        mode: 'insensitive'
                    }
                }
            });

            // Si no existe, crearlo
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
                    scope: 'read:users read:roles',
                })
            );

            return response.data.access_token;
        } catch (error) {
            this.logger.error(`Error al obtener token de gestión: ${error.message}`);
            throw new Error('Error al obtener token de gestión');
        }
    }
}