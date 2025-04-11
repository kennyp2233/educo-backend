// src/padres/padres.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PadresService {
    private readonly logger = new Logger(PadresService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Obtiene todos los hijos vinculados a un padre
     */
    async obtenerHijos(padreId: string) {
        try {
            // Verificar que el padre existe
            const padre = await this.prisma.padre.findUnique({
                where: { usuarioId: padreId }
            });

            if (!padre) {
                throw new NotFoundException(`Padre con ID ${padreId} no encontrado`);
            }

            // Obtener todas las vinculaciones del padre con estudiantes
            const vinculaciones = await this.prisma.padreEstudiante.findMany({
                where: {
                    padreId,
                    // Solo mostrar vinculaciones aprobadas
                    estadoVinculacion: 'APROBADO'
                },
                include: {
                    estudiante: {
                        include: {
                            usuario: true,
                            curso: {
                                include: {
                                    institucion: true
                                }
                            }
                        }
                    }
                }
            });

            // Formatear la respuesta
            return vinculaciones.map(v => ({
                vinculacion: {
                    id: `${v.padreId}_${v.estudianteId}`,
                    esRepresentante: v.esRepresentante,
                    estadoVinculacion: v.estadoVinculacion
                },
                estudiante: {
                    id: v.estudiante.usuarioId,
                    grado: v.estudiante.grado,
                    nombre: v.estudiante.usuario.nombre,
                    curso: {
                        id: v.estudiante.curso.id,
                        nombre: v.estudiante.curso.nombre,
                        paralelo: v.estudiante.curso.paralelo,
                        anioLectivo: v.estudiante.curso.anioLectivo,
                        institucion: {
                            id: v.estudiante.curso.institucion.id,
                            nombre: v.estudiante.curso.institucion.nombre
                        }
                    }
                }
            }));
        } catch (error) {
            this.logger.error(`Error al obtener hijos del padre ${padreId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Obtiene todos los cursos disponibles, opcionalmente filtrados
     */
    async obtenerCursosDisponibles(
        institucionId?: string,
        anioLectivo?: string,
        grado?: string
    ) {
        try {
            // Construir filtros dinámicamente
            const filtros: any = {};

            if (institucionId) {
                filtros.institucionId = parseInt(institucionId);
            }

            if (anioLectivo) {
                filtros.anioLectivo = anioLectivo;
            }

            // Obtener los cursos con los filtros aplicados
            const cursos = await this.prisma.curso.findMany({
                where: filtros,
                include: {
                    institucion: true,
                    // Incluir conteo de estudiantes por curso
                    _count: {
                        select: {
                            estudiantes: true
                        }
                    }
                },
                orderBy: [
                    { institucionId: 'asc' },
                    { anioLectivo: 'desc' },
                    { nombre: 'asc' }
                ]
            });

            // Aplicar filtro de grado si es necesario (no está en el modelo, sino en estudiantes)
            let cursosResult = cursos;

            if (grado) {
                // Primero obtenemos los cursos que tienen estudiantes con ese grado
                const cursoIdsConGrado = await this.prisma.estudiante.findMany({
                    where: { grado },
                    select: { cursoId: true },
                    distinct: ['cursoId']
                });

                const cursoIdsSet = new Set(cursoIdsConGrado.map(c => c.cursoId));

                // Filtramos los cursos que contienen al menos un estudiante con el grado especificado
                cursosResult = cursos.filter(curso => cursoIdsSet.has(curso.id));
            }

            // Formatear la respuesta
            return cursosResult.map(curso => ({
                id: curso.id,
                nombre: curso.nombre,
                paralelo: curso.paralelo,
                anioLectivo: curso.anioLectivo,
                cantidadEstudiantes: curso._count.estudiantes,
                institucion: {
                    id: curso.institucion.id,
                    nombre: curso.institucion.nombre,
                    direccion: curso.institucion.direccion
                }
            }));
        } catch (error) {
            this.logger.error(`Error al obtener cursos disponibles: ${error.message}`);
            throw error;
        }
    }

    /**
     * Obtiene información detallada de un curso específico
     */
    async obtenerDetalleCurso(cursoId: string) {
        try {
            const id = parseInt(cursoId);

            const curso = await this.prisma.curso.findUnique({
                where: { id },
                include: {
                    institucion: true,
                    profesorCurso: {
                        where: { esTutor: true },
                        include: {
                            profesor: {
                                include: {
                                    usuario: true
                                }
                            }
                        }
                    },
                    estudiantes: {
                        take: 0, // No necesitamos los estudiantes específicos, solo el conteo
                        select: { usuarioId: true }
                    },
                    _count: {
                        select: {
                            estudiantes: true
                        }
                    }
                }
            });

            if (!curso) {
                throw new NotFoundException(`Curso con ID ${cursoId} no encontrado`);
            }

            // Obtener recaudaciones activas para este curso
            const recaudaciones = await this.prisma.recaudacion.findMany({
                where: {
                    estado: 'ABIERTA',
                    tesorero: {
                        cursoId: id
                    }
                },
                select: {
                    id: true,
                    titulo: true,
                    montoTotal: true,
                    fechaCierre: true
                }
            });

            // Formatear respuesta
            return {
                id: curso.id,
                nombre: curso.nombre,
                paralelo: curso.paralelo,
                anioLectivo: curso.anioLectivo,
                institucion: {
                    id: curso.institucion.id,
                    nombre: curso.institucion.nombre,
                    direccion: curso.institucion.direccion,
                    telefono: curso.institucion.telefono
                },
                tutores: curso.profesorCurso
                    .filter(pc => pc.esTutor)
                    .map(pc => ({
                        id: pc.profesor.usuarioId,
                        especialidad: pc.profesor.especialidad
                    })),
                cantidadEstudiantes: curso._count.estudiantes,
                recaudacionesActivas: recaudaciones
            };
        } catch (error) {
            this.logger.error(`Error al obtener detalle del curso ${cursoId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Obtiene un dashboard resumido para un padre
     */
    async obtenerDashboard(padreId: string) {
        try {
            // Verificar que el padre existe
            const padre = await this.prisma.padre.findUnique({
                where: { usuarioId: padreId },
                include: {
                    usuario: true
                }
            });

            if (!padre) {
                throw new NotFoundException(`Padre con ID ${padreId} no encontrado`);
            }

            // Obtener hijos
            const hijos = await this.prisma.padreEstudiante.findMany({
                where: {
                    padreId,
                    estadoVinculacion: 'APROBADO'
                },
                include: {
                    estudiante: {
                        include: {
                            usuario: true,
                            curso: true
                        }
                    }
                }
            });

            // Obtener pagos pendientes
            const pagos = await this.prisma.abono.findMany({
                where: {
                    padreId,
                    estado: { in: ['PENDIENTE', 'RECHAZADO'] }
                },
                include: {
                    recaudacion: true,
                    estudiante: true
                }
            });

            // Obtener permisos
            const permisos = await this.prisma.permiso.findMany({
                where: {
                    padreId,
                    estado: { in: ['PENDIENTE', 'APROBADO'] }
                },
                include: {
                    estudiante: true,
                    curso: true
                }
            });

            // Obtener notificaciones no leídas
            const notificaciones = await this.prisma.notificacion.findMany({
                where: {
                    usuarioReceptorId: padreId,
                    leida: false
                },
                orderBy: {
                    fecha: 'desc'
                },
                take: 5
            });

            // Formatear respuesta
            return {
                padre: {
                    id: padre.usuarioId,
                    direccion: padre.direccion,
                    telefono: padre.telefono
                },
                hijos: hijos.map(h => ({
                    id: h.estudiante.usuarioId,
                    grado: h.estudiante.grado,
                    esRepresentante: h.esRepresentante,
                    curso: {
                        id: h.estudiante.curso.id,
                        nombre: h.estudiante.curso.nombre,
                        paralelo: h.estudiante.curso.paralelo
                    }
                })),
                pagosPendientes: pagos.map(p => ({
                    id: p.id,
                    monto: p.monto,
                    estado: p.estado,
                    recaudacion: {
                        id: p.recaudacion.id,
                        titulo: p.recaudacion.titulo,
                        fechaCierre: p.recaudacion.fechaCierre
                    },
                    estudiante: {
                        id: p.estudiante.usuarioId,
                        grado: p.estudiante.grado
                    }
                })),
                permisos: permisos.map(p => ({
                    id: p.id,
                    titulo: p.titulo,
                    tipoPermiso: p.tipoPermiso,
                    estado: p.estado,
                    fechaInicio: p.fechaInicio,
                    fechaFin: p.fechaFin,
                    estudiante: p.estudiante ? {
                        id: p.estudiante.usuarioId,
                        grado: p.estudiante.grado
                    } : null,
                    curso: {
                        id: p.curso.id,
                        nombre: p.curso.nombre
                    }
                })),
                notificaciones: notificaciones.map(n => ({
                    id: n.id,
                    titulo: n.titulo,
                    tipo: n.tipo,
                    fecha: n.fecha
                })),
                resumen: {
                    cantidadHijos: hijos.length,
                    cantidadPagosPendientes: pagos.length,
                    cantidadPermisosPendientes: permisos.filter(p => p.estado === 'PENDIENTE').length,
                    cantidadPermisosAprobados: permisos.filter(p => p.estado === 'APROBADO').length,
                    cantidadNotificacionesNoLeidas: notificaciones.length
                }
            };
        } catch (error) {
            this.logger.error(`Error al obtener dashboard del padre ${padreId}: ${error.message}`);
            throw error;
        }
    }

    /**
  * Obtiene todas las vinculaciones pendientes entre padres e hijos
  */
    async obtenerVinculacionesPendientes(padreId?: string): Promise<any[]> {
        try {
            // Construir filtro
            const where: any = {
                estadoVinculacion: 'PENDIENTE'
            };

            // Si se proporciona un ID de padre específico, filtrar por ese padre
            if (padreId) {
                where.padreId = padreId;
            }

            // Obtener todas las vinculaciones pendientes
            const vinculacionesPendientes = await this.prisma.padreEstudiante.findMany({
                where,
                include: {
                    padre: {
                        include: {
                            usuario: true
                        }
                    },
                    estudiante: {
                        include: {
                            usuario: true,
                            curso: {
                                include: {
                                    institucion: true
                                }
                            }
                        }
                    }
                }
            });

            // Formatear la respuesta para que sea más fácil de usar
            return vinculacionesPendientes.map(v => ({
                vinculacion: {
                    padreId: v.padreId,
                    estudianteId: v.estudianteId,
                    esRepresentante: v.esRepresentante,
                    estadoVinculacion: v.estadoVinculacion,
                    fechaSolicitud: v.fechaAprobacion || null // Si es null, usaremos la fecha de creación de la vinculación
                },
                padre: {
                    id: v.padre.usuarioId,
                    direccion: v.padre.direccion,
                    telefono: v.padre.telefono
                },
                estudiante: {
                    id: v.estudiante.usuarioId,
                    nombre: v.estudiante.usuario.nombre,
                    grado: v.estudiante.grado,
                    curso: {
                        id: v.estudiante.curso.id,
                        nombre: v.estudiante.curso.nombre,
                        paralelo: v.estudiante.curso.paralelo,
                        anioLectivo: v.estudiante.curso.anioLectivo,
                        institucion: {
                            id: v.estudiante.curso.institucion.id,
                            nombre: v.estudiante.curso.institucion.nombre
                        }
                    }
                }
            }));
        } catch (error) {
            this.logger.error(`Error al obtener vinculaciones pendientes: ${error.message}`);
            throw error;
        }
    }

    /**
     * Obtiene todas las recaudaciones activas organizadas por hijo y curso
     */
    async obtenerRecaudacionesPorHijo(padreId: string) {
        try {
            // Verificar que el padre existe
            const padre = await this.prisma.padre.findUnique({
                where: { usuarioId: padreId }
            });

            if (!padre) {
                throw new NotFoundException(`Padre con ID ${padreId} no encontrado`);
            }

            // Obtener todos los hijos del padre con vinculación aprobada
            const hijos = await this.prisma.padreEstudiante.findMany({
                where: {
                    padreId,
                    estadoVinculacion: 'APROBADO'
                },
                include: {
                    estudiante: {
                        include: {
                            usuario: true,
                            curso: {
                                include: {
                                    institucion: true
                                }
                            }
                        }
                    }
                }
            });

            if (hijos.length === 0) {
                return {
                    totalPendiente: 0,
                    totalAbonado: 0,
                    hayRecaudacionesActivas: false,
                    hijos: []
                };
            }

            // Obtener IDs de estudiantes
            const estudianteIds = hijos.map(h => h.estudianteId);

            // Obtener IDs de cursos de los estudiantes
            const cursoIds = [...new Set(hijos.map(h => h.estudiante.cursoId))];

            // Obtener todas las recaudaciones activas para estos cursos
            const recaudacionesActivas = await this.prisma.recaudacion.findMany({
                where: {
                    estado: 'ABIERTA',
                    tesorero: {
                        cursoId: {
                            in: cursoIds
                        }
                    }
                },
                include: {
                    tesorero: {
                        include: {
                            curso: true
                        }
                    }
                }
            });

            // Obtener todos los abonos realizados por este padre para estas recaudaciones
            const abonos = await this.prisma.abono.findMany({
                where: {
                    padreId,
                    estudianteId: {
                        in: estudianteIds
                    },
                    recaudacionId: {
                        in: recaudacionesActivas.map(r => r.id)
                    }
                }
            });

            // Calcular totales generales
            let totalPendiente = 0;
            let totalAbonado = 0;

            // Organizar datos por hijo -> curso -> recaudaciones
            const hijosConRecaudaciones = [];

            for (const hijoVinculo of hijos) {
                const estudiante = hijoVinculo.estudiante;
                const curso = estudiante.curso;

                // Filtrar recaudaciones para este curso
                const recaudacionesCurso = recaudacionesActivas.filter(
                    r => r.tesorero.cursoId === curso.id
                );

                if (recaudacionesCurso.length === 0) {
                    continue;
                }

                const recaudacionesEstudiante = [];

                for (const recaudacion of recaudacionesCurso) {
                    // Buscar abonos de este estudiante para esta recaudación
                    const abonosEstudiante = abonos.filter(
                        a => a.estudianteId === estudiante.usuarioId && a.recaudacionId === recaudacion.id
                    );

                    // Calcular monto abonado (solo de abonos aprobados)
                    const montoAbonado = abonosEstudiante
                        .filter(a => a.estado === 'APROBADO')
                        .reduce((sum, abono) => sum + abono.monto, 0);

                    // Calcular monto pendiente
                    const montoPendiente = recaudacion.montoTotal - montoAbonado;

                    // Actualizar totales generales
                    totalPendiente += montoPendiente;
                    totalAbonado += montoAbonado;

                    // Añadir recaudación con sus detalles
                    recaudacionesEstudiante.push({
                        id: recaudacion.id,
                        titulo: recaudacion.titulo,
                        descripcion: recaudacion.descripcion,
                        montoTotal: recaudacion.montoTotal,
                        montoAbonado,
                        montoPendiente,
                        fechaCierre: recaudacion.fechaCierre,
                        estado: recaudacion.estado,
                        abonos: abonosEstudiante
                    });
                }

                // Solo añadir el hijo si tiene recaudaciones
                if (recaudacionesEstudiante.length > 0) {
                    hijosConRecaudaciones.push({
                        estudiante: {
                            id: estudiante.usuarioId,
                            nombre: estudiante.usuario.nombre,
                            grado: estudiante.grado
                        },
                        curso: {
                            id: curso.id,
                            nombre: curso.nombre,
                            paralelo: curso.paralelo,
                            anioLectivo: curso.anioLectivo,
                            institucion: {
                                id: curso.institucion.id,
                                nombre: curso.institucion.nombre
                            }
                        },
                        recaudaciones: recaudacionesEstudiante
                    });
                }
            }
            console.log('hijosConRecaudaciones', hijosConRecaudaciones);
            return {
                totalPendiente,
                totalAbonado,
                hayRecaudacionesActivas: hijosConRecaudaciones.length > 0,
                hijos: hijosConRecaudaciones
            };
        } catch (error) {
            this.logger.error(`Error al obtener recaudaciones por hijo del padre ${padreId}: ${error.message}`);
            throw error;
        }
    }
}