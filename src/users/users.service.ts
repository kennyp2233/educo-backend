import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    Usuario,
    Rol, Padre,
    Estudiante,
    Profesor,
    Tesorero,
    Curso,
    PrismaClient
} from '@prisma/client';

export type PerfilUsuario = {
    tipo: 'padre' | 'estudiante' | 'profesor' | 'tesorero';
    datos: any;
}

@Injectable()
export class UsuariosService {
    private readonly logger = new Logger(UsuariosService.name);

    constructor(private prisma: PrismaService) { }

    async verificarRolAprobado(usuarioId: string, rolNombre: string): Promise<boolean> {
        const usuarioRol = await this.prisma.usuarioRol.findFirst({
            where: {
                usuarioId,
                rol: {
                    nombre: {
                        contains: rolNombre,
                        mode: 'insensitive'
                    }
                },
                estadoAprobacion: 'APROBADO'
            }
        });

        return !!usuarioRol;
    }

    /**
     * Busca un usuario por su email (anteriormente por Auth0 ID)
     * @param email Email del usuario
     * @param includeRelations Si es verdadero, incluye las relaciones (padre, estudiante, etc.)
     */
    async buscarPorEmail(email: string, includeRelations: boolean = false): Promise<any | null> {
        if (includeRelations) {
            return this.prisma.usuario.findUnique({
                where: { email },
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
            return this.prisma.usuario.findUnique({
                where: { email }
            });
        }
    }

    /**
     * Busca un usuario por su ID interno
     */
    async buscarPorId(id: string): Promise<Usuario | null> {
        return this.prisma.usuario.findUnique({
            where: { id },
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

    /**
     * Crear usuario básico
     */
    async crearUsuario(email: string, password: string, nombre?: string): Promise<Usuario> {
        return this.prisma.usuario.create({
            data: {
                email,
                password,
                nombre: nombre || email
            },
        });
    }

    /**
     * Asignar rol a usuario
     */
    async asignarRol(usuarioId: string, rolId: number): Promise<void> {
        // Verificar si el rol ya existe para este usuario
        const rolExistente = await this.prisma.usuarioRol.findUnique({
            where: {
                usuarioId_rolId: {
                    usuarioId,
                    rolId
                }
            }
        });

        if (!rolExistente) {
            await this.prisma.usuarioRol.create({
                data: {
                    usuarioId,
                    rolId,
                }
            });
        }
    }

    /**
     * Obtener todos los roles disponibles
     */
    async obtenerRoles(): Promise<Rol[]> {
        return this.prisma.rol.findMany();
    }

    /**
     * Obtener rol por nombre
     */
    async obtenerRolPorNombre(nombre: string): Promise<Rol | null> {
        return this.prisma.rol.findUnique({
            where: { nombre }
        });
    }

    /**
     * Crear usuario y asignar rol en una transacción
     */
    async crearUsuarioConRol(email: string, password: string, nombre: string, rolId: number): Promise<Usuario> {
        return this.prisma.executeTransaction(async (prisma) => {
            const usuario = await prisma.usuario.create({
                data: {
                    email,
                    password,
                    nombre
                },
            });

            await prisma.usuarioRol.create({
                data: {
                    usuarioId: usuario.id,
                    rolId,
                },
            });

            return usuario;
        });
    }

    /**
     * Eliminar usuario
     */
    async eliminarUsuario(usuarioId: string): Promise<Usuario> {
        try {
            return await this.prisma.usuario.delete({
                where: { id: usuarioId },
            });
        } catch (error) {
            this.logger.error(`Error al eliminar usuario ${usuarioId}: ${error.message}`);
            throw new NotFoundException(`Usuario con ID ${usuarioId} no encontrado`);
        }
    }

    /**
     * Actualizar datos del usuario
     */
    async actualizarUsuario(id: string, datos: any): Promise<Usuario> {
        // Buscar si el usuario ya existe
        const usuarioExistente = await this.buscarPorId(id);

        if (!usuarioExistente) {
            throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
        }

        // Si existe, actualizar los datos
        return this.prisma.usuario.update({
            where: { id },
            data: datos,
        });
    }

    /**
     * Crear perfil de padre para un usuario existente
     */
    async crearPerfilPadre(usuarioId: string, datos: { direccion: string, telefono: string }): Promise<Padre> {
        const usuario = await this.buscarPorId(usuarioId);
        if (!usuario) {
            throw new NotFoundException(`Usuario con ID ${usuarioId} no encontrado`);
        }

        return this.prisma.padre.create({
            data: {
                usuarioId,
                direccion: datos.direccion,
                telefono: datos.telefono
            }
        });
    }

    /**
     * Crear perfil de estudiante para un usuario existente
     */
    async crearPerfilEstudiante(
        usuarioId: string,
        datos: { cursoId: number, grado: string }
    ): Promise<Estudiante> {
        const usuario = await this.buscarPorId(usuarioId);
        if (!usuario) {
            throw new NotFoundException(`Usuario con ID ${usuarioId} no encontrado`);
        }

        return this.prisma.estudiante.create({
            data: {
                usuarioId,
                cursoId: datos.cursoId,
                grado: datos.grado
            }
        });
    }

    /**
     * Crear perfil de profesor para un usuario existente
     */
    async crearPerfilProfesor(
        usuarioId: string,
        datos: { especialidad: string }
    ): Promise<Profesor> {
        const usuario = await this.buscarPorId(usuarioId);
        if (!usuario) {
            throw new NotFoundException(`Usuario con ID ${usuarioId} no encontrado`);
        }

        return this.prisma.profesor.create({
            data: {
                usuarioId,
                especialidad: datos.especialidad
            }
        });
    }

    /**
     * Crear perfil de tesorero para un usuario existente
     */
    async crearPerfilTesorero(
        usuarioId: string,
        datos: { cursoId: number }
    ): Promise<Tesorero> {
        const usuario = await this.buscarPorId(usuarioId);
        if (!usuario) {
            throw new NotFoundException(`Usuario con ID ${usuarioId} no encontrado`);
        }

        return this.prisma.tesorero.create({
            data: {
                usuarioId,
                cursoId: datos.cursoId
            }
        });
    }

    /**
     * Asignar un estudiante a un padre
     */
    async asignarEstudianteAPadre(
        padreId: string,
        estudianteId: string,
        esRepresentante: boolean
    ): Promise<any> {
        const padre = await this.prisma.padre.findUnique({ where: { usuarioId: padreId } });
        if (!padre) {
            throw new NotFoundException(`Padre con ID ${padreId} no encontrado`);
        }

        const estudiante = await this.prisma.estudiante.findUnique({ where: { usuarioId: estudianteId } });
        if (!estudiante) {
            throw new NotFoundException(`Estudiante con ID ${estudianteId} no encontrado`);
        }

        return this.prisma.padreEstudiante.create({
            data: {
                padreId,
                estudianteId,
                esRepresentante
            }
        });
    }

    /**
     * Asignar un profesor a un curso
     */
    async asignarProfesorACurso(
        profesorId: string,
        cursoId: number,
        esTutor: boolean
    ): Promise<any> {
        const profesor = await this.prisma.profesor.findUnique({ where: { usuarioId: profesorId } });
        if (!profesor) {
            throw new NotFoundException(`Profesor con ID ${profesorId} no encontrado`);
        }

        const curso = await this.prisma.curso.findUnique({ where: { id: cursoId } });
        if (!curso) {
            throw new NotFoundException(`Curso con ID ${cursoId} no encontrado`);
        }

        return this.prisma.profesorCurso.create({
            data: {
                profesorId,
                cursoId,
                esTutor
            }
        });
    }

    /**
     * Crear usuario completo con perfil según su rol
     */
    async crearUsuarioCompleto(
        email: string,
        password: string,
        nombre: string,
        rolNombre: string,
        perfilData: any
    ): Promise<Usuario> {
        return this.prisma.executeTransaction(async (prisma) => {
            // 1. Buscar rol por nombre
            const rol = await prisma.rol.findUnique({ where: { nombre: rolNombre } });
            if (!rol) {
                throw new NotFoundException(`Rol ${rolNombre} no encontrado`);
            }

            // 2. Crear usuario base
            const usuario = await prisma.usuario.create({
                data: {
                    email,
                    password,
                    nombre
                }
            });

            // 3. Asignar rol
            await prisma.usuarioRol.create({
                data: {
                    usuarioId: usuario.id,
                    rolId: rol.id
                }
            });

            // 4. Crear perfil según rol
            switch (rolNombre.toLowerCase()) {
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

            return usuario;
        });
    }

    async obtenerRolesUsuario(usuarioId: string): Promise<string[]> {
        const usuarioRoles = await this.prisma.usuarioRol.findMany({
            where: { usuarioId },
            include: {
                rol: true
            }
        });

        if (!usuarioRoles || usuarioRoles.length === 0) {
            return [];
        }

        return usuarioRoles.map(ur => ur.rol.nombre);
    }

    /**
     * Obtiene todos los roles aprobados de un usuario
     */
    async obtenerRolesAprobados(usuarioId: string): Promise<string[]> {
        const usuarioRoles = await this.prisma.usuarioRol.findMany({
            where: {
                usuarioId,
                estadoAprobacion: 'APROBADO'
            },
            include: {
                rol: true
            }
        });

        return usuarioRoles.map(ur => ur.rol.nombre);
    }

    /**
     * Busca un usuario por Auth0 ID (método compatible con código anterior)
     * @deprecated Usa buscarPorEmail en su lugar
     */
    async buscarPorAuth0Id(auth0Id: string, includeRelations: boolean = false): Promise<any | null> {
        // Asumimos que auth0Id se usó como email en la migración
        return this.buscarPorEmail(auth0Id, includeRelations);
    }
}