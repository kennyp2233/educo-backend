// src/permisos/permisos.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionService } from '../notificacion/notificacion.service';
import { CreatePermisoAccesoDto, TipoPermiso } from './dto/create-permiso-acceso.dto';
import { UpdatePermisoAccesoDto, EstadoPermiso } from './dto/update-permiso-acceso.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PermisosAccesoService {
    private readonly logger = new Logger(PermisosAccesoService.name);

    constructor(
        private prisma: PrismaService,
        private notificacionService: NotificacionService
    ) { }

    /**
     * Obtiene todos los permisos de acceso
     */
    async findAll() {
        return this.prisma.permisoAcceso.findMany({
            include: {
                padre: {
                    include: {
                        usuario: true
                    }
                },
                curso: true,
                aprobador: true
            }
        });
    }

    /**
     * Obtiene los permisos de un padre específico
     */
    async findByPadre(padreId: string) {
        return this.prisma.permisoAcceso.findMany({
            where: { padreId },
            include: {
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
        return this.prisma.permisoAcceso.findMany({
            where: { cursoId },
            include: {
                padre: {
                    include: {
                        usuario: true
                    }
                },
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
        return this.prisma.permisoAcceso.findMany({
            where: {
                cursoId: {
                    in: cursosTutor
                },
                estadoPermiso: 'PENDIENTE'
            },
            include: {
                padre: {
                    include: {
                        usuario: true
                    }
                },
                curso: true
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
        const permiso = await this.prisma.permisoAcceso.findUnique({
            where: { id },
            include: {
                padre: {
                    include: {
                        usuario: true
                    }
                },
                curso: true,
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
        const permiso = await this.prisma.permisoAcceso.findUnique({
            where: { codigoQR },
            include: {
                padre: {
                    include: {
                        usuario: true
                    }
                },
                curso: true,
                aprobador: true
            }
        });

        if (!permiso) {
            throw new NotFoundException(`Permiso con código QR ${codigoQR} no encontrado`);
        }

        return permiso;
    }

    /**
     * Crea un nuevo permiso de acceso
     */
    async create(createPermisoDto: CreatePermisoAccesoDto) {
        // Validar que el padre existe
        const padre = await this.prisma.padre.findUnique({
            where: { usuarioId: createPermisoDto.padreId }
        });

        if (!padre) {
            throw new NotFoundException(`Padre con ID ${createPermisoDto.padreId} no encontrado`);
        }

        // Validar que el curso existe
        const cursoId = parseInt(createPermisoDto.cursoId);
        const curso = await this.prisma.curso.findUnique({
            where: { id: cursoId }
        });

        if (!curso) {
            throw new NotFoundException(`Curso con ID ${cursoId} no encontrado`);
        }

        // Validar fechas
        const fechaInicio = new Date(createPermisoDto.fechaInicio);
        const fechaFin = new Date(createPermisoDto.fechaFin);

        if (fechaInicio >= fechaFin) {
            throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin');
        }

        if (fechaInicio < new Date()) {
            throw new BadRequestException('La fecha de inicio debe ser futura');
        }

        // Para permisos de emergencia, se puede omitir la validación de fecha futura
        if (createPermisoDto.tipoPermiso === TipoPermiso.EMERGENCIA) {
            // Permitir fechas inmediatas para emergencias
        }

        // Crear permiso
        const permiso = await this.prisma.permisoAcceso.create({
            data: {
                padreId: createPermisoDto.padreId,
                cursoId,
                tipoPermiso: createPermisoDto.tipoPermiso,
                motivo: createPermisoDto.motivo,
                fechaInicio,
                fechaFin,
                estadoPermiso: EstadoPermiso.PENDIENTE,
                fechaCreacion: new Date()
            }
        });

        // Notificar a tutores del curso
        await this.notificarTutores(
            cursoId,
            'Nuevo permiso de acceso pendiente',
            `El padre con ID ${createPermisoDto.padreId} solicita permiso de acceso por: ${createPermisoDto.motivo}`
        );

        return permiso;
    }

    /**
     * Actualiza un permiso existente
     */
    async update(id: number, updatePermisoDto: UpdatePermisoAccesoDto) {
        // Verificar que el permiso existe
        const permisoExistente = await this.prisma.permisoAcceso.findUnique({
            where: { id }
        });

        if (!permisoExistente) {
            throw new NotFoundException(`Permiso con ID ${id} no encontrado`);
        }

        // Solo se pueden modificar permisos pendientes
        if (permisoExistente.estadoPermiso !== EstadoPermiso.PENDIENTE) {
            throw new BadRequestException(`No se puede modificar un permiso en estado ${permisoExistente.estadoPermiso}`);
        }

        // Preparar datos para actualizar
        const dataToUpdate: any = {};

        if (updatePermisoDto.tipoPermiso) {
            dataToUpdate.tipoPermiso = updatePermisoDto.tipoPermiso;
        }

        if (updatePermisoDto.motivo) {
            dataToUpdate.motivo = updatePermisoDto.motivo;
        }

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

        return this.prisma.permisoAcceso.update({
            where: { id },
            data: dataToUpdate
        });
    }

    /**
     * Aprueba un permiso de acceso
     */
    async aprobar(id: number, tutorId: string, comentarios?: string) {
        // Verificar que el permiso existe
        const permiso = await this.prisma.permisoAcceso.findUnique({
            where: { id },
            include: {
                curso: true
            }
        });

        if (!permiso) {
            throw new NotFoundException(`Permiso con ID ${id} no encontrado`);
        }

        // Verificar que el permiso está pendiente
        if (permiso.estadoPermiso !== EstadoPermiso.PENDIENTE) {
            throw new BadRequestException(`El permiso ya está en estado ${permiso.estadoPermiso}`);
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
        const permisoAprobado = await this.prisma.permisoAcceso.update({
            where: { id },
            data: {
                estadoPermiso: EstadoPermiso.APROBADO,
                aprobadorId: tutorId,
                fechaAprobacion: new Date(),
                codigoQR
            }
        });

        // Notificar al padre
        await this.notificacionService.create({
            usuarioReceptorId: permiso.padreId,
            titulo: 'Permiso de acceso aprobado',
            mensaje: `Su permiso de acceso ha sido aprobado. Utilice el código QR proporcionado para acceder.`,
            tipo: 'EXITO'
        });

        return permisoAprobado;
    }

    /**
     * Rechaza un permiso de acceso
     */
    async rechazar(id: number, tutorId: string, comentarios?: string) {
        // Verificar que el permiso existe
        const permiso = await this.prisma.permisoAcceso.findUnique({
            where: { id }
        });

        if (!permiso) {
            throw new NotFoundException(`Permiso con ID ${id} no encontrado`);
        }

        // Verificar que el permiso está pendiente
        if (permiso.estadoPermiso !== EstadoPermiso.PENDIENTE) {
            throw new BadRequestException(`El permiso ya está en estado ${permiso.estadoPermiso}`);
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
        const permisoRechazado = await this.prisma.permisoAcceso.update({
            where: { id },
            data: {
                estadoPermiso: EstadoPermiso.RECHAZADO,
                aprobadorId: tutorId,
                fechaAprobacion: new Date()
            }
        });

        // Notificar al padre
        await this.notificacionService.create({
            usuarioReceptorId: permiso.padreId,
            titulo: 'Permiso de acceso rechazado',
            mensaje: comentarios || 'Su permiso de acceso ha sido rechazado.',
            tipo: 'ALERTA'
        });

        return permisoRechazado;
    }

    /**
     * Marca un permiso como utilizado
     */
    async marcarUtilizado(codigoQR: string) {
        // Verificar que el permiso existe
        const permiso = await this.prisma.permisoAcceso.findUnique({
            where: { codigoQR }
        });

        if (!permiso) {
            throw new NotFoundException(`Permiso con código QR ${codigoQR} no encontrado`);
        }

        // Verificar que el permiso está aprobado
        if (permiso.estadoPermiso !== EstadoPermiso.APROBADO) {
            throw new BadRequestException(`El permiso no está aprobado, estado actual: ${permiso.estadoPermiso}`);
        }

        // Verificar que el permiso es válido (no ha vencido)
        const ahora = new Date();
        if (permiso.fechaFin < ahora) {
            // Actualizar a vencido
            await this.prisma.permisoAcceso.update({
                where: { id: permiso.id },
                data: {
                    estadoPermiso: EstadoPermiso.VENCIDO
                }
            });
            throw new BadRequestException('El permiso ha vencido');
        }

        if (permiso.fechaInicio > ahora) {
            throw new BadRequestException('El permiso aún no es válido, comienza en: ' + permiso.fechaInicio);
        }

        // Actualizar estado a utilizado
        return this.prisma.permisoAcceso.update({
            where: { id: permiso.id },
            data: {
                estadoPermiso: EstadoPermiso.UTILIZADO
            }
        });
    }

    /**
     * Elimina un permiso
     */
    async remove(id: number) {
        const permiso = await this.prisma.permisoAcceso.findUnique({
            where: { id }
        });

        if (!permiso) {
            throw new NotFoundException(`Permiso con ID ${id} no encontrado`);
        }

        return this.prisma.permisoAcceso.delete({
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