// src/auth/auth.service.ts
import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UsuariosService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly usuariosService: UsuariosService,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Validar usuario para estrategia local
     */
    async validateUser(email: string, password: string): Promise<any> {
        // Buscar usuario por email
        const user = await this.prisma.usuario.findFirst({
            where: { email },
            include: {
                roles: {
                    include: { rol: true },
                },
            },
        });

        if (!user) {
            throw new UnauthorizedException('Credenciales inválidas');
        }

        // Verificar password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Credenciales inválidas');
        }

        // No devolver el hash de la contraseña
        const { password: _, ...result } = user;
        return result;
    }

    /**
     * Iniciar sesión y generar tokens
     */
    async login(loginDto: LoginDto): Promise<any> {
        try {
            // Validar usuario
            const user = await this.validateUser(loginDto.email, loginDto.password);

            // Generar tokens
            const tokens = await this.generateTokens(user);

            // Obtener roles
            const roles = user.roles.map(r => r.rol.nombre);
            const rolesWithApproval = user.roles.map(r => ({
                role: r.rol.nombre,
                status: r.estadoAprobacion
            }));

            // Obtener perfil específico
            const userProfile = await this.determineUserProfile(user);

            // Formato compatible con Auth0 para minimizar impacto
            return {
                auth: {
                    tokens: {
                        access_token: tokens.accessToken,
                        refresh_token: tokens.refreshToken,
                        expires_in: 86400, // 24 horas en segundos
                        token_type: 'Bearer',
                    },
                },
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.nombre || user.email,
                    roles,
                    rolesApproved: rolesWithApproval,
                    profile: userProfile,
                },
            };
        } catch (error) {
            this.logger.error(`Error en login: ${error.message}`);
            throw new UnauthorizedException(error.message || 'Error al iniciar sesión');
        }
    }

    /**
     * Registrar nuevo usuario
     */
    async register(registerDto: RegisterDto): Promise<any> {
        try {
            // Verificar si el email ya existe
            const existingUser = await this.prisma.usuario.findFirst({
                where: { email: registerDto.email },
            });

            if (existingUser) {
                throw new BadRequestException('El email ya está en uso');
            }

            // Hash de la contraseña
            const hashedPassword = await bcrypt.hash(registerDto.password, 10);

            // Transacción para crear usuario y asignar rol
            const newUser = await this.prisma.executeTransaction(async (prisma) => {
                // 1. Crear usuario base
                const usuario = await prisma.usuario.create({
                    data: {
                        email: registerDto.email,
                        password: hashedPassword,
                        nombre: registerDto.fullName,
                    },
                });

                // 2. Buscar rol por nombre
                const rol = await prisma.rol.findFirst({
                    where: {
                        nombre: {
                            contains: registerDto.role,
                            mode: 'insensitive'
                        }
                    },
                });

                if (!rol) {
                    throw new BadRequestException(`Rol '${registerDto.role}' no encontrado`);
                }

                // 3. Asignar rol al usuario
                await prisma.usuarioRol.create({
                    data: {
                        usuarioId: usuario.id,
                        rolId: rol.id,
                        estadoAprobacion: 'PENDIENTE',
                    },
                });

                // 4. Crear perfil específico según rol
                switch (registerDto.role.toLowerCase()) {
                    case 'padre':
                    case 'padre_familia':
                        if (registerDto.perfilData) {
                            await prisma.padre.create({
                                data: {
                                    usuarioId: usuario.id,
                                    direccion: registerDto.perfilData.direccion || 'Por completar',
                                    telefono: registerDto.perfilData.telefono || 'Por completar',
                                },
                            });
                        } else {
                            await prisma.padre.create({
                                data: {
                                    usuarioId: usuario.id,
                                    direccion: 'Por completar',
                                    telefono: 'Por completar',
                                },
                            });
                        }
                        break;

                    case 'estudiante':
                        if (registerDto.perfilData) {
                            await prisma.estudiante.create({
                                data: {
                                    usuarioId: usuario.id,
                                    cursoId: registerDto.perfilData.cursoId || await this.getDefaultCursoId(),
                                    grado: registerDto.perfilData.grado || 'Por asignar',
                                },
                            });
                        } else {
                            await prisma.estudiante.create({
                                data: {
                                    usuarioId: usuario.id,
                                    cursoId: await this.getDefaultCursoId(),
                                    grado: 'Por asignar',
                                },
                            });
                        }
                        break;

                    case 'profesor':
                        if (registerDto.perfilData) {
                            await prisma.profesor.create({
                                data: {
                                    usuarioId: usuario.id,
                                    especialidad: registerDto.perfilData.especialidad || 'Por completar',
                                },
                            });
                        } else {
                            await prisma.profesor.create({
                                data: {
                                    usuarioId: usuario.id,
                                    especialidad: 'Por completar',
                                },
                            });
                        }
                        break;

                    case 'tesorero':
                        if (registerDto.perfilData) {
                            await prisma.tesorero.create({
                                data: {
                                    usuarioId: usuario.id,
                                    cursoId: registerDto.perfilData.cursoId || await this.getDefaultCursoId(),
                                },
                            });
                        } else {
                            await prisma.tesorero.create({
                                data: {
                                    usuarioId: usuario.id,
                                    cursoId: await this.getDefaultCursoId(),
                                },
                            });
                        }
                        break;
                }

                return usuario;
            });

            // Login automático después del registro
            return this.login({ email: registerDto.email, password: registerDto.password });
        } catch (error) {
            this.logger.error(`Error en registro: ${error.message}`);
            throw new BadRequestException(error.message || 'Error al registrar usuario');
        }
    }

    /**
     * Renovar el token de acceso usando el refresh token
     */
    async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<any> {
        try {
            // Verificar refresh token
            const payload = this.jwtService.verify(refreshTokenDto.refreshToken, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
            });

            // Buscar usuario
            const user = await this.prisma.usuario.findUnique({
                where: { id: payload.sub },
                include: {
                    roles: {
                        include: { rol: true },
                    },
                },
            });

            if (!user) {
                throw new UnauthorizedException('Token inválido');
            }

            // Generar nuevos tokens
            const tokens = await this.generateTokens(user);

            // Obtener roles
            const roles = user.roles.map(r => r.rol.nombre);
            const rolesWithApproval = user.roles.map(r => ({
                role: r.rol.nombre,
                status: r.estadoAprobacion
            }));

            // Obtener perfil específico
            const userProfile = await this.determineUserProfile(user);

            // Formato compatible con Auth0
            return {
                auth: {
                    tokens: {
                        access_token: tokens.accessToken,
                        refresh_token: tokens.refreshToken,
                        expires_in: 86400,
                        token_type: 'Bearer',
                    },
                },
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.nombre || user.email,
                    roles,
                    rolesApproved: rolesWithApproval,
                    profile: userProfile,
                },
            };
        } catch (error) {
            this.logger.error(`Error en refresh token: ${error.message}`);
            throw new UnauthorizedException('Token inválido o expirado');
        }
    }

    /**
     * Obtener el perfil de usuario con sus detalles
     */
    async getUserProfile(userId: string): Promise<any> {
        try {
            const user = await this.prisma.usuario.findUnique({
                where: { id: userId },
                include: {
                    roles: {
                        include: { rol: true },
                    },
                    padres: true,
                    estudiante: true,
                    profesor: true,
                    tesorero: true,
                },
            });

            if (!user) {
                throw new UnauthorizedException('Usuario no encontrado');
            }

            // Obtener roles
            const roles = user.roles.map(r => r.rol.nombre);
            const rolesWithApproval = user.roles.map(r => ({
                role: r.rol.nombre,
                status: r.estadoAprobacion
            }));

            // Obtener perfil específico
            const userProfile = await this.determineUserProfile(user);

            // Formato compatible con Auth0
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.nombre || user.email,
                    roles,
                    rolesApproved: rolesWithApproval,
                    profile: userProfile,
                },
            };
        } catch (error) {
            this.logger.error(`Error al obtener perfil de usuario: ${error.message}`);
            throw error;
        }
    }

    /**
     * Genera tokens de JWT (acceso y refresh)
     * @private
     */
    private async generateTokens(user: any): Promise<{ accessToken: string; refreshToken: string }> {
        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            roles: user.roles.map(r => r.rol.nombre),
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload),
            this.jwtService.signAsync(
                { ...payload, tokenType: 'refresh' },
                {
                    secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
                    expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
                },
            ),
        ]);

        return {
            accessToken,
            refreshToken,
        };
    }

    /**
     * Determina el tipo de perfil del usuario
     * @private
     */
    private async determineUserProfile(user: any): Promise<any> {
        if (user.padres) {
            return {
                type: 'padre',
                data: user.padres,
            };
        } else if (user.estudiante) {
            return {
                type: 'estudiante',
                data: user.estudiante,
            };
        } else if (user.profesor) {
            return {
                type: 'profesor',
                data: user.profesor,
            };
        } else if (user.tesorero) {
            return {
                type: 'tesorero',
                data: user.tesorero,
            };
        } else {
            // Verificar si tiene rol de admin
            const roles = user.roles.map(r => r.rol.nombre.toLowerCase());
            if (roles.includes('admin')) {
                return { type: 'admin' };
            }

            return { type: 'none' };
        }
    }

    /**
     * Obtiene el ID de un curso por defecto para nuevos perfiles
     * @private
     */
    private async getDefaultCursoId(): Promise<number> {
        const curso = await this.prisma.curso.findFirst();
        if (!curso) {
            throw new BadRequestException('No hay cursos disponibles en el sistema');
        }
        return curso.id;
    }
}