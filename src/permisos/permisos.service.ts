// src/permisos/permisos.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionService } from '../notificacion/notificacion.service';
import { CreatePermisoDto, TipoPermiso } from './dto/create-permiso.dto';
import { UpdatePermisoDto } from './dto/update-permiso.dto';
import { v4 as uuidv4 } from 'uuid';
import { $Enums } from '@prisma/client';

@Injectable()
export class PermisosService {
    private readonly logger = new Logger(PermisosService.name);

    constructor(
        private prisma: PrismaService,
        private notificacionService: NotificacionService
    ) { }

    /**
     * Obtiene todos los permisos
     */
    async findAll() {
        return this.prisma.permiso.findMany({
            include: {
                padre: {
                    include: {
                        usuario: true
                    }
                },
                curso: true,
                estudiante: true,
                aprobador: true
            }
        });
    }

    /**
     * Obtiene los permisos por tipo (acceso o evento)
     */
    async findByTipo(tipoPermiso: TipoPermiso) {
        return this.prisma.permiso.findMany({
            where: { tipoPermiso },
            include: {
                padre: {
                    include: {
                        usuario: true
                    }
                },
                curso: true,
                estudiante: true,
                aprobador: true
            }
        });
    }

    /**
     * Obtiene los permisos de un padre específico
     */
    async findByPadre(padreId: string) {
        return this.prisma.permiso.findMany({
            where: { padreId },
            include: {
                curso: true,
                estudiante: true,
                aprobador: true
            },
            orderBy: {
                fechaCreacion: 'desc'
            }
        });
    }

    /**
     * Obtiene los permisos de un estudiante específico
     */
    async findByEstudiante(estudianteId: string) {
        return this.prisma.permiso.findMany({
            where: { estudianteId },
            include: {
                padre: {
                    include: {
                        usuario: true
                    }
                },
                curso: true,
                aprobador: true
            },
            orderBy: {
                fechaCreacion: 'desc'
            }
        });
    }

    /**
     * Obtiene los permisos de un curso específico
     */
    async findByCurso(cursoId: number) {
        return this.prisma.permiso.findMany({
            where: { cursoId },
            include: {
                padre: {
                    include: {
                        usuario: true
                    }
                },
                estudiante: true,
                aprobador: true
            },
            orderBy: {
                fechaCreacion: 'desc'
            }
        });
    }

    /**
     * Obtiene los permisos pendientes que debe aprobar un tutor
     */
    async findPendientesByTutor(tutorId: string) {
        // Verificar que es un profesor
        const profesor = await this.prisma.profesor.findUnique({
            where: { usuarioId: tutorId },
            include: {
                cursos: true
            }
        });

        if (!profesor) {
            throw new NotFoundException(`Profesor con ID ${tutorId} no encontrado`);
        }

        // Obtener cursos donde es tutor
        const cursosTutor = profesor.cursos
            .filter(c => c.esTutor)
            .map(c => c.cursoId);

        if (cursosTutor.length === 0) {
            return [];
        }

        // Obtener permisos pendientes de esos cursos
        return this.prisma.permiso.findMany({
            where: {
                cursoId: {
                    in: cursosTutor
                },
                estado: 'PENDIENTE'
            },
            include: {
                padre: {
                    include: {
                        usuario: true
                    }
                },
                curso: true,
                estudiante: true
            },
            orderBy: {
                fechaCreacion: 'asc'
            }
        });
    }

    /**
     * Obtiene un permiso por su ID
     */
    async findOne(id: number) {
        const permiso = await this.prisma.permiso.findUnique({
            where: { id },
            include: {
                padre: {
                    include: {
                        usuario: true
                    }
                },
                curso: true,
                estudiante: true,
                aprobador: true
            }
        });

        if (!permiso) {
            throw new NotFoundException(`Permiso con ID ${id} no encontrado`);
        }

        return permiso;
    }

    /**
     * Obtiene un permiso por su código QR
     */
    async findByQR(codigoQR: string) {
        const permiso = await this.prisma.permiso.findUnique({
            where: { codigoQR },
            include: {
                padre: {
                    include: {
                        usuario: true
                    }
                },
                curso: true,
                estudiante: true,
                aprobador: true
            }
        });

        if (!permiso) {
            throw new NotFoundException(`Permiso con código QR ${codigoQR} no encontrado`);
        }

        return permiso;
    }

    /**
     * Crea un nuevo permiso
     */
    async create(createPermisoDto: CreatePermisoDto) {
        // Validar que el padre existe
        const padre = await this.prisma.padre.findUnique({
            where: { usuarioId: createPermisoDto.padreId },
            include: {
                usuario: {
                    include: {
                        roles: {
                            include: {
                                rol: true
                            }
                        }
                    }
                }
            }
        });

        if (!padre) {
            throw new NotFoundException(`Padre con ID ${createPermisoDto.padreId} no encontrado`);
        }

        const rolAprobado = padre.usuario.roles.some(r =>
            ['padre', 'padre_familia'].includes(r.rol.nombre.toLowerCase()) &&
            r.estadoAprobacion === 'APROBADO'
        );

        if (!rolAprobado) {
            throw new BadRequestException('El padre no está aprobado para realizar esta acción');
        }

        // Validar que el curso existe
        const cursoId = parseInt(createPermisoDto.cursoId);
        const curso = await this.prisma.curso.findUnique({
            where: { id: cursoId }
        });

        if (!curso) {
            throw new NotFoundException(`Curso con ID ${cursoId} no encontrado`);
        }

        // Si es un permiso para estudiante específico, validar que existe y es hijo del padre
        if (createPermisoDto.estudianteId) {
            const estudiante = await this.prisma.estudiante.findUnique({
                where: { usuarioId: createPermisoDto.estudianteId }
            });

            if (!estudiante) {
                throw new NotFoundException(`Estudiante con ID ${createPermisoDto.estudianteId} no encontrado`);
            }

            // Verificar que el estudiante está vinculado al padre
            const relacion = await this.prisma.padreEstudiante.findUnique({
                where: {
                    padreId_estudianteId: {
                        padreId: createPermisoDto.padreId,
                        estudianteId: createPermisoDto.estudianteId
                    }
                }
            });

            if (!relacion) {
                throw new BadRequestException('El estudiante no está vinculado a este padre');
            }
        }

        // Validar fechas
        const fechaInicio = new Date(createPermisoDto.fechaInicio);
        const fechaFin = new Date(createPermisoDto.fechaFin);

        if (fechaInicio >= fechaFin) {
            throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin');
        }

        // Para emergencias, se puede omitir la validación de fecha futura
        if (createPermisoDto.tipoPermiso !== TipoPermiso.EMERGENCIA && fechaInicio < new Date()) {
            throw new BadRequestException('La fecha de inicio debe ser futura');
        }

        // Crear permiso
        const permiso = await this.prisma.permiso.create({
            data: {
                padreId: createPermisoDto.padreId,
                cursoId,
                estudianteId: createPermisoDto.estudianteId || null,
                titulo: createPermisoDto.titulo,
                descripcion: createPermisoDto.descripcion,
                tipoPermiso: createPermisoDto.tipoPermiso,
                fechaInicio,
                fechaFin,
                estado: $Enums.EstadoPermiso.PENDIENTE,
                fechaCreacion: new Date()
            }
        });

        // Notificar a tutores del curso
        await this.notificarTutores(
            cursoId,
            'Nuevo permiso pendiente',
            `El padre con ID ${createPermisoDto.padreId} solicita permiso de tipo ${createPermisoDto.tipoPermiso}`
        );

        return permiso;
    }

    /**
     * Actualiza un permiso existente
     */
    async update(id: number, updatePermisoDto: UpdatePermisoDto) {
        // Verificar que el permiso existe
        const permisoExistente = await this.prisma.permiso.findUnique({
            where: { id }
        });

        if (!permisoExistente) {
            throw new NotFoundException(`Permiso con ID ${id} no encontrado`);
        }

        // Solo se pueden modificar permisos pendientes
        if (permisoExistente.estado !== $Enums.EstadoPermiso.PENDIENTE) {
            throw new BadRequestException(`No se puede modificar un permiso en estado ${permisoExistente.estado}`);
        }

        // Preparar datos para actualizar
        const dataToUpdate: any = {};

        // Actualizar solo los campos proporcionados
        if (updatePermisoDto.titulo) dataToUpdate.titulo = updatePermisoDto.titulo;
        if (updatePermisoDto.descripcion) dataToUpdate.descripcion = updatePermisoDto.descripcion;
        if (updatePermisoDto.tipoPermiso) dataToUpdate.tipoPermiso = updatePermisoDto.tipoPermiso;
        if (updatePermisoDto.estado) dataToUpdate.estado = updatePermisoDto.estado;

        if (updatePermisoDto.fechaInicio) {
            dataToUpdate.fechaInicio = new Date(updatePermisoDto.fechaInicio);
        }

        if (updatePermisoDto.fechaFin) {
            dataToUpdate.fechaFin = new Date(updatePermisoDto.fechaFin);
        }

        // Validar fechas si se están actualizando
        if (dataToUpdate.fechaInicio || dataToUpdate.fechaFin) {
            const fechaInicio = dataToUpdate.fechaInicio || permisoExistente.fechaInicio;
            const fechaFin = dataToUpdate.fechaFin || permisoExistente.fechaFin;

            if (fechaInicio >= fechaFin) {
                throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin');
            }
        }

        return this.prisma.permiso.update({
            where: { id },
            data: dataToUpdate
        });
    }

    /**
     * Aprueba un permiso
     */
    async aprobar(id: number, tutorId: string, comentarios?: string) {
        // Verificar que el permiso existe
        const permiso = await this.prisma.permiso.findUnique({
            where: { id },
            include: {
                curso: true
            }
        });

        if (!permiso) {
            throw new NotFoundException(`Permiso con ID ${id} no encontrado`);
        }

        // Verificar que el permiso está pendiente
        if (permiso.estado !== $Enums.EstadoPermiso.PENDIENTE) {
            throw new BadRequestException(`El permiso ya está en estado ${permiso.estado}`);
        }

        // Verificar que el tutor tiene permisos para aprobar (es tutor del curso)
        const esTutor = await this.prisma.profesorCurso.findUnique({
            where: {
                profesorId_cursoId: {
                    profesorId: tutorId,
                    cursoId: permiso.cursoId
                }
            }
        });

        if (!esTutor || !esTutor.esTutor) {
            throw new BadRequestException('No tiene permisos para aprobar este permiso');
        }

        // Generar código QR único
        const codigoQR = uuidv4();

        // Actualizar permiso
        const permisoAprobado = await this.prisma.permiso.update({
            where: { id },
            data: {
                estado: $Enums.EstadoPermiso.APROBADO,
                aprobadorId: tutorId,
                fechaAprobacion: new Date(),
                codigoQR
            }
        });

        // Notificar al padre
        await this.notificacionService.create({
            usuarioReceptorId: permiso.padreId,
            titulo: 'Permiso aprobado',
            mensaje: `Su permiso ha sido aprobado. Utilice el código QR proporcionado.`,
            tipo: 'EXITO'
        });

        return permisoAprobado;
    }

    /**
     * Rechaza un permiso
     */
    async rechazar(id: number, tutorId: string, comentarios?: string) {
        // Verificar que el permiso existe
        const permiso = await this.prisma.permiso.findUnique({
            where: { id }
        });

        if (!permiso) {
            throw new NotFoundException(`Permiso con ID ${id} no encontrado`);
        }

        // Verificar que el permiso está pendiente
        if (permiso.estado !== $Enums.EstadoPermiso.PENDIENTE) {
            throw new BadRequestException(`El permiso ya está en estado ${permiso.estado}`);
        }

        // Verificar que el tutor tiene permisos para rechazar (es tutor del curso)
        const esTutor = await this.prisma.profesorCurso.findUnique({
            where: {
                profesorId_cursoId: {
                    profesorId: tutorId,
                    cursoId: permiso.cursoId
                }
            }
        });

        if (!esTutor || !esTutor.esTutor) {
            throw new BadRequestException('No tiene permisos para rechazar este permiso');
        }

        // Actualizar permiso
        const permisoRechazado = await this.prisma.permiso.update({
            where: { id },
            data: {
                estado: $Enums.EstadoPermiso.RECHAZADO,
                aprobadorId: tutorId,
                fechaAprobacion: new Date()
            }
        });

        // Notificar al padre
        await this.notificacionService.create({
            usuarioReceptorId: permiso.padreId,
            titulo: 'Permiso rechazado',
            mensaje: comentarios || 'Su permiso ha sido rechazado.',
            tipo: 'ALERTA'
        });

        return permisoRechazado;
    }

    /**
     * Marca un permiso como utilizado
     */
    async marcarUtilizado(codigoQR: string) {
        // Verificar que el permiso existe
        const permiso = await this.prisma.permiso.findUnique({
            where: { codigoQR }
        });

        if (!permiso) {
            throw new NotFoundException(`Permiso con código QR ${codigoQR} no encontrado`);
        }

        // Verificar que el permiso está aprobado
        if (permiso.estado !== $Enums.EstadoPermiso.APROBADO) {
            throw new BadRequestException(`El permiso no está aprobado, estado actual: ${permiso.estado}`);
        }

        // Verificar que el permiso es válido (no ha vencido)
        const ahora = new Date();
        if (permiso.fechaFin < ahora) {
            // Actualizar a vencido
            await this.prisma.permiso.update({
                where: { id: permiso.id },
                data: {
                    estado: $Enums.EstadoPermiso.VENCIDO
                }
            });
            throw new BadRequestException('El permiso ha vencido');
        }

        if (permiso.fechaInicio > ahora) {
            throw new BadRequestException('El permiso aún no es válido, comienza en: ' + permiso.fechaInicio);
        }

        // Actualizar estado a utilizado
        return this.prisma.permiso.update({
            where: { id: permiso.id },
            data: {
                estado: $Enums.EstadoPermiso.UTILIZADO
            }
        });
    }

    /**
     * Elimina un permiso
     */
    async remove(id: number) {
        const permiso = await this.prisma.permiso.findUnique({
            where: { id }
        });

        if (!permiso) {
            throw new NotFoundException(`Permiso con ID ${id} no encontrado`);
        }

        return this.prisma.permiso.delete({
            where: { id }
        });
    }

    /**
     * Notifica a los tutores de un curso
     */
    private async notificarTutores(cursoId: number, titulo: string, mensaje: string) {
        const tutores = await this.prisma.profesorCurso.findMany({
            where: {
                cursoId,
                esTutor: true
            },
            select: {
                profesorId: true
            }
        });

        for (const tutor of tutores) {
            await this.notificacionService.create({
                usuarioReceptorId: tutor.profesorId,
                titulo,
                mensaje,
                tipo: 'INFO'
            });
        }
    }
}