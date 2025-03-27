// src/users/user-institution.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserInstitutionService {
    private readonly logger = new Logger(UserInstitutionService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Obtiene la institución asociada a un usuario, según su rol
     * @param usuarioId ID del usuario
     * @returns Información de la institución o instituciones asociadas
     */
    async getInstitutionByUser(usuarioId: string) {
        try {
            // Primero verificamos si el usuario existe
            const usuario = await this.prisma.usuario.findUnique({
                where: { id: usuarioId }
            });

            if (!usuario) {
                throw new NotFoundException(`Usuario con ID ${usuarioId} no encontrado`);
            }

            // Colección para almacenar todas las instituciones asociadas
            const instituciones = new Map();

            // Verificar si es estudiante
            const estudiante = await this.prisma.estudiante.findUnique({
                where: { usuarioId },
                include: {
                    curso: {
                        include: {
                            institucion: true
                        }
                    }
                }
            });

            if (estudiante) {
                instituciones.set(estudiante.curso.institucion.id, {
                    id: estudiante.curso.institucion.id,
                    nombre: estudiante.curso.institucion.nombre,
                    direccion: estudiante.curso.institucion.direccion,
                    telefono: estudiante.curso.institucion.telefono,
                    rolUsuario: 'estudiante',
                    cursos: [{
                        id: estudiante.curso.id,
                        nombre: estudiante.curso.nombre,
                        paralelo: estudiante.curso.paralelo,
                        anioLectivo: estudiante.curso.anioLectivo
                    }]
                });
            }

            // Verificar si es profesor
            const profesor = await this.prisma.profesor.findUnique({
                where: { usuarioId },
                include: {
                    cursos: {
                        include: {
                            curso: {
                                include: {
                                    institucion: true
                                }
                            }
                        }
                    }
                }
            });

            if (profesor && profesor.cursos.length > 0) {
                for (const cursoPrf of profesor.cursos) {
                    const institucionId = cursoPrf.curso.institucion.id;

                    if (!instituciones.has(institucionId)) {
                        instituciones.set(institucionId, {
                            id: institucionId,
                            nombre: cursoPrf.curso.institucion.nombre,
                            direccion: cursoPrf.curso.institucion.direccion,
                            telefono: cursoPrf.curso.institucion.telefono,
                            rolUsuario: 'profesor',
                            cursos: []
                        });
                    }

                    instituciones.get(institucionId).cursos.push({
                        id: cursoPrf.curso.id,
                        nombre: cursoPrf.curso.nombre,
                        paralelo: cursoPrf.curso.paralelo,
                        anioLectivo: cursoPrf.curso.anioLectivo,
                        esTutor: cursoPrf.esTutor
                    });
                }
            }

            // Verificar si es tesorero
            const tesorero = await this.prisma.tesorero.findUnique({
                where: { usuarioId },
                include: {
                    curso: {
                        include: {
                            institucion: true
                        }
                    }
                }
            });

            if (tesorero) {
                const institucionId = tesorero.curso.institucion.id;

                if (!instituciones.has(institucionId)) {
                    instituciones.set(institucionId, {
                        id: institucionId,
                        nombre: tesorero.curso.institucion.nombre,
                        direccion: tesorero.curso.institucion.direccion,
                        telefono: tesorero.curso.institucion.telefono,
                        rolUsuario: 'tesorero',
                        cursos: []
                    });
                }

                // Si ya tenemos esta institución pero con otro rol, agregamos tesorero
                if (instituciones.get(institucionId).rolUsuario !== 'tesorero') {
                    instituciones.get(institucionId).rolUsuario += ', tesorero';
                }

                // Verificar si ya existe este curso en la lista
                const cursoExiste = instituciones.get(institucionId).cursos.some(
                    c => c.id === tesorero.curso.id
                );

                if (!cursoExiste) {
                    instituciones.get(institucionId).cursos.push({
                        id: tesorero.curso.id,
                        nombre: tesorero.curso.nombre,
                        paralelo: tesorero.curso.paralelo,
                        anioLectivo: tesorero.curso.anioLectivo
                    });
                }
            }

            // Verificar si es padre de estudiantes
            const padre = await this.prisma.padre.findUnique({
                where: { usuarioId },
                include: {
                    hijos: {
                        where: {
                            estadoVinculacion: 'APROBADO' // Solo vinculaciones aprobadas
                        },
                        include: {
                            estudiante: {
                                include: {
                                    curso: {
                                        include: {
                                            institucion: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (padre && padre.hijos.length > 0) {
                for (const hijo of padre.hijos) {
                    const institucionId = hijo.estudiante.curso.institucion.id;

                    if (!instituciones.has(institucionId)) {
                        instituciones.set(institucionId, {
                            id: institucionId,
                            nombre: hijo.estudiante.curso.institucion.nombre,
                            direccion: hijo.estudiante.curso.institucion.direccion,
                            telefono: hijo.estudiante.curso.institucion.telefono,
                            rolUsuario: 'padre',
                            cursos: []
                        });
                    }

                    // Si ya tenemos esta institución pero con otro rol, agregamos padre
                    if (instituciones.get(institucionId).rolUsuario !== 'padre') {
                        instituciones.get(institucionId).rolUsuario += ', padre';
                    }

                    // Verificar si ya existe este curso en la lista
                    const cursoExiste = instituciones.get(institucionId).cursos.some(
                        c => c.id === hijo.estudiante.curso.id
                    );

                    if (!cursoExiste) {
                        instituciones.get(institucionId).cursos.push({
                            id: hijo.estudiante.curso.id,
                            nombre: hijo.estudiante.curso.nombre,
                            paralelo: hijo.estudiante.curso.paralelo,
                            anioLectivo: hijo.estudiante.curso.anioLectivo,
                            hijoId: hijo.estudianteId,
                            esRepresentante: hijo.esRepresentante
                        });
                    }
                }
            }

            // Si no encontramos ninguna institución asociada
            if (instituciones.size === 0) {
                // Verificar si es administrador del sistema
                const isAdmin = await this.isUserAdmin(usuarioId);
                if (isAdmin) {
                    // Los administradores pueden acceder a todas las instituciones
                    const todasInstituciones = await this.prisma.institucion.findMany({
                        include: {
                            cursos: true
                        }
                    });

                    return {
                        rolUsuario: 'admin',
                        mensaje: 'Administrador con acceso a todas las instituciones',
                        instituciones: todasInstituciones.map(inst => ({
                            id: inst.id,
                            nombre: inst.nombre,
                            direccion: inst.direccion,
                            telefono: inst.telefono,
                            cursos: inst.cursos.map(curso => ({
                                id: curso.id,
                                nombre: curso.nombre,
                                paralelo: curso.paralelo,
                                anioLectivo: curso.anioLectivo
                            }))
                        }))
                    };
                } else {
                    return {
                        mensaje: 'El usuario no está asociado a ninguna institución',
                        instituciones: []
                    };
                }
            }

            // Convertir el Map a un array de instituciones
            const institucionesArray = Array.from(instituciones.values());

            return {
                instituciones: institucionesArray
            };
        } catch (error) {
            this.logger.error(`Error al obtener institución del usuario ${usuarioId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verifica si un usuario tiene rol de administrador
     * @private
     */
    private async isUserAdmin(usuarioId: string): Promise<boolean> {
        const adminRol = await this.prisma.usuarioRol.findFirst({
            where: {
                usuarioId,
                rol: {
                    nombre: {
                        contains: 'admin',
                        mode: 'insensitive'
                    }
                },
                estadoAprobacion: 'APROBADO'
            }
        });

        return !!adminRol;
    }
}