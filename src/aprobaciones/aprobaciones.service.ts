// src/aprobaciones/aprobaciones.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionService } from '../notificacion/notificacion.service';
import { TipoAprobacion } from './dto/solicitar-aprobacion.dto';
import { ResolverAprobacionDto } from './dto/resolver-aprobacion.dto';
import { VincularEstudianteDto } from './dto/vincular-estudiante.dto';

@Injectable()
export class AprobacionesService {
    private readonly logger = new Logger(AprobacionesService.name);

    constructor(
        private prisma: PrismaService,
        private notificacionService: NotificacionService
    ) { }

    /**
     * Solicita la aprobación de un perfil de usuario
     */
    async solicitarAprobacionPerfil(usuarioId: string) {
        // Verificar que el usuario existe
        const usuario = await this.prisma.usuario.findUnique({
            where: { id: usuarioId },
            include: {
                roles: {
                    include: {
                        rol: true
                    }
                },
                estadoAprobacion: true
            }
        });

        if (!usuario) {
            throw new NotFoundException(`Usuario con ID ${usuarioId} no encontrado`);
        }

        // Verificar si ya tiene una solicitud pendiente
        if (usuario.estadoAprobacion) {
            if (usuario.estadoAprobacion.estadoActual === 'PENDIENTE') {
                throw new BadRequestException('El usuario ya tiene una solicitud de aprobación pendiente');
            } else if (usuario.estadoAprobacion.estadoActual === 'APROBADO') {
                throw new BadRequestException('El usuario ya está aprobado');
            }
        }

        // Crear solicitud de aprobación
        const estadoAprobacion = await this.prisma.estadoAprobacion.create({
            data: {
                usuarioId,
                estadoActual: 'PENDIENTE',
                fechaSolicitud: new Date()
            }
        });

        // Encontrar a quién notificar (administradores para profesores, tutores para padres/estudiantes)
        const roles = usuario.roles.map(r => r.rol.nombre);

        if (roles.includes('profesor')) {
            // Notificar a administradores
            await this.notificarAdministradores(
                `Solicitud de aprobación de profesor`,
                `El profesor con ID ${usuarioId} solicita aprobación de su perfil`
            );
        } else if (roles.includes('padre') || roles.includes('estudiante')) {
            // Si es estudiante, notificar a tutores de su curso
            if (roles.includes('estudiante')) {
                await this.notificarTutoresCurso(
                    usuarioId,
                    `Solicitud de aprobación de estudiante`,
                    `El estudiante con ID ${usuarioId} solicita aprobación de su perfil`
                );
            }
            // Si es padre, notificar a tutores de sus hijos
            if (roles.includes('padre')) {
                await this.notificarTutoresPadre(
                    usuarioId,
                    `Solicitud de aprobación de padre`,
                    `El padre con ID ${usuarioId} solicita aprobación de su perfil`
                );
            }
        }

        return estadoAprobacion;
    }

    /**
     * Resuelve una solicitud de aprobación (aprobar o rechazar)
     */
    async resolverAprobacion(
        usuarioId: string,
        aprobadorId: string,
        data: ResolverAprobacionDto
    ) {
        // Verificar que el usuario y su solicitud existen
        const estadoAprobacion = await this.prisma.estadoAprobacion.findUnique({
            where: { usuarioId },
            include: {
                usuario: {
                    include: {
                        roles: {
                            include: {
                                rol: true
                            }
                        },
                        estudiante: true
                    }
                }
            }
        });

        if (!estadoAprobacion) {
            throw new NotFoundException(`No se encontró solicitud de aprobación para el usuario ${usuarioId}`);
        }

        if (estadoAprobacion.estadoActual !== 'PENDIENTE') {
            throw new BadRequestException(`La solicitud ya fue ${estadoAprobacion.estadoActual.toLowerCase()}`);
        }

        // Verificar que el aprobador tiene permisos para aprobar
        const puedeAprobar = await this.puedeAprobar(aprobadorId, usuarioId);
        if (!puedeAprobar) {
            throw new BadRequestException('No tiene permisos para aprobar esta solicitud');
        }

        // Actualizar estado de aprobación
        const nuevoEstado = data.aprobado ? 'APROBADO' : 'RECHAZADO';

        const estadoActualizado = await this.prisma.estadoAprobacion.update({
            where: { usuarioId },
            data: {
                estadoActual: nuevoEstado,
                aprobadorId,
                fechaResolucion: new Date(),
                comentarios: data.comentarios
            }
        });

        // Notificar al usuario sobre la resolución
        await this.notificacionService.create({
            usuarioReceptorId: usuarioId,
            titulo: `Solicitud de aprobación ${nuevoEstado.toLowerCase()}`,
            mensaje: data.comentarios || `Su solicitud ha sido ${nuevoEstado.toLowerCase()}`,
            tipo: data.aprobado ? 'EXITO' : 'ALERTA'
        });

        return estadoActualizado;
    }

    /**
     * Solicita vinculación entre padre y estudiante
     */
    async solicitarVinculacion(data: VincularEstudianteDto) {
        // Verificar que el padre y estudiante existen
        const padre = await this.prisma.padre.findUnique({
            where: { usuarioId: data.padreId },
            include: { usuario: true }
        });

        if (!padre) {
            throw new NotFoundException(`Padre con ID ${data.padreId} no encontrado`);
        }

        const estudiante = await this.prisma.estudiante.findUnique({
            where: { usuarioId: data.estudianteId },
            include: {
                usuario: true,
                curso: true
            }
        });

        if (!estudiante) {
            throw new NotFoundException(`Estudiante con ID ${data.estudianteId} no encontrado`);
        }

        // Verificar que no existe ya una vinculación
        const vinculacionExistente = await this.prisma.padreEstudiante.findUnique({
            where: {
                padreId_estudianteId: {
                    padreId: data.padreId,
                    estudianteId: data.estudianteId
                }
            }
        });

        if (vinculacionExistente) {
            throw new BadRequestException('Ya existe una vinculación entre este padre y estudiante');
        }

        // Crear vinculación en estado pendiente
        const vinculacion = await this.prisma.padreEstudiante.create({
            data: {
                padreId: data.padreId,
                estudianteId: data.estudianteId,
                esRepresentante: data.esRepresentante,
                estadoVinculacion: 'PENDIENTE'
            }
        });

        // Notificar a los tutores del curso del estudiante
        await this.notificarTutoresCurso(
            data.estudianteId,
            'Solicitud de vinculación padre-estudiante',
            `El padre con ID ${data.padreId} solicita vinculación con el estudiante con ID ${data.estudianteId}`
        );

        return vinculacion;
    }

    /**
     * Aprueba la vinculación entre padre y estudiante
     */
    async aprobarVinculacion(
        padreId: string,
        estudianteId: string,
        aprobadorId: string,
        aprobado: boolean,
        comentarios?: string
    ) {
        // Verificar que existe la vinculación
        const vinculacion = await this.prisma.padreEstudiante.findUnique({
            where: {
                padreId_estudianteId: {
                    padreId,
                    estudianteId
                }
            },
            include: {
                estudiante: {
                    include: {
                        curso: true
                    }
                }
            }
        });

        if (!vinculacion) {
            throw new NotFoundException('No se encontró la vinculación solicitada');
        }

        if (vinculacion.estadoVinculacion !== 'PENDIENTE') {
            throw new BadRequestException(`La vinculación ya fue ${vinculacion.estadoVinculacion.toLowerCase()}`);
        }

        // Verificar que el aprobador es tutor del curso del estudiante
        const esTutor = await this.prisma.profesorCurso.findFirst({
            where: {
                profesorId: aprobadorId,
                cursoId: vinculacion.estudiante.cursoId,
                esTutor: true
            }
        });

        if (!esTutor) {
            throw new BadRequestException('No tiene permisos para aprobar esta vinculación');
        }

        // Actualizar estado de vinculación
        const nuevoEstado = aprobado ? 'APROBADO' : 'RECHAZADO';

        const vinculacionActualizada = await this.prisma.padreEstudiante.update({
            where: {
                padreId_estudianteId: {
                    padreId,
                    estudianteId
                }
            },
            data: {
                estadoVinculacion: nuevoEstado,
                aprobadorId,
                fechaAprobacion: new Date()
            }
        });

        // Notificar al padre sobre la resolución
        await this.notificacionService.create({
            usuarioReceptorId: padreId,
            titulo: `Vinculación con estudiante ${nuevoEstado.toLowerCase()}`,
            mensaje: comentarios || `Su solicitud de vinculación ha sido ${nuevoEstado.toLowerCase()}`,
            tipo: aprobado ? 'EXITO' : 'ALERTA'
        });

        return vinculacionActualizada;
    }

    /**
     * Verifica si un usuario puede aprobar a otro
     */
    async puedeAprobar(aprobadorId: string, usuarioId: string): Promise<boolean> {
        // Obtener roles del aprobador
        const aprobador = await this.prisma.usuario.findUnique({
            where: { id: aprobadorId },
            include: {
                roles: {
                    include: {
                        rol: true
                    }
                },
                profesor: {
                    include: {
                        cursos: true
                    }
                }
            }
        });

        if (!aprobador) {
            return false;
        }

        const rolesAprobador = aprobador.roles.map(r => r.rol.nombre);

        // Obtener roles del usuario a aprobar
        const usuario = await this.prisma.usuario.findUnique({
            where: { id: usuarioId },
            include: {
                roles: {
                    include: {
                        rol: true
                    }
                },
                estudiante: true
            }
        });

        if (!usuario) {
            return false;
        }

        const rolesUsuario = usuario.roles.map(r => r.rol.nombre);

        // Un administrador puede aprobar a cualquiera
        if (rolesAprobador.includes('admin')) {
            return true;
        }

        // Un profesor solo puede aprobar padres y estudiantes si es tutor de su curso
        if (rolesAprobador.includes('profesor')) {
            // Si el usuario es estudiante, verificar que el profesor es tutor de su curso
            if (rolesUsuario.includes('estudiante') && usuario.estudiante) {
                return aprobador.profesor.cursos.some(c =>
                    c.cursoId === usuario.estudiante.cursoId && c.esTutor
                );
            }

            // Si el usuario es padre, verificar si tiene hijos en cursos donde el profesor es tutor
            if (rolesUsuario.includes('padre')) {
                const hijosDelPadre = await this.prisma.padreEstudiante.findMany({
                    where: { padreId: usuarioId },
                    include: { estudiante: true }
                });

                return hijosDelPadre.some(h =>
                    aprobador.profesor.cursos.some(c =>
                        c.cursoId === h.estudiante.cursoId && c.esTutor
                    )
                );
            }
        }

        return false;
    }

    /**
     * Notifica a todos los administradores del sistema
     */
    private async notificarAdministradores(titulo: string, mensaje: string) {
        // Encontrar todos los usuarios con rol de administrador
        const admins = await this.prisma.usuarioRol.findMany({
            where: {
                rol: {
                    nombre: 'admin'
                }
            },
            select: {
                usuarioId: true
            }
        });

        // Enviar notificación a cada administrador
        for (const admin of admins) {
            await this.notificacionService.create({
                usuarioReceptorId: admin.usuarioId,
                titulo,
                mensaje,
                tipo: 'INFO'
            });
        }
    }

    /**
     * Notifica a los tutores del curso de un estudiante
     */
    private async notificarTutoresCurso(estudianteId: string, titulo: string, mensaje: string) {
        // Encontrar el curso del estudiante
        const estudiante = await this.prisma.estudiante.findUnique({
            where: { usuarioId: estudianteId }
        });

        if (!estudiante) {
            return;
        }

        // Encontrar todos los tutores de ese curso
        const tutores = await this.prisma.profesorCurso.findMany({
            where: {
                cursoId: estudiante.cursoId,
                esTutor: true
            },
            select: {
                profesorId: true
            }
        });

        // Enviar notificación a cada tutor
        for (const tutor of tutores) {
            await this.notificacionService.create({
                usuarioReceptorId: tutor.profesorId,
                titulo,
                mensaje,
                tipo: 'INFO'
            });
        }
    }

    /**
     * Notifica a los tutores de los cursos donde el padre tiene hijos
     */
    private async notificarTutoresPadre(padreId: string, titulo: string, mensaje: string) {
        // Encontrar hijos del padre
        const hijos = await this.prisma.padreEstudiante.findMany({
            where: { padreId },
            include: { estudiante: true }
        });

        if (hijos.length === 0) {
            return;
        }

        // Set para evitar duplicados de tutores
        const tutoresNotificados = new Set<string>();

        // Para cada hijo, notificar a sus tutores
        for (const hijo of hijos) {
            const tutores = await this.prisma.profesorCurso.findMany({
                where: {
                    cursoId: hijo.estudiante.cursoId,
                    esTutor: true
                },
                select: {
                    profesorId: true
                }
            });

            // Enviar notificación a cada tutor (sin duplicados)
            for (const tutor of tutores) {
                if (!tutoresNotificados.has(tutor.profesorId)) {
                    await this.notificacionService.create({
                        usuarioReceptorId: tutor.profesorId,
                        titulo,
                        mensaje,
                        tipo: 'INFO'
                    });
                    tutoresNotificados.add(tutor.profesorId);
                }
            }
        }
    }

    /**
     * Obtiene las solicitudes pendientes que un usuario puede aprobar
     */
    async obtenerSolicitudesPendientes(aprobadorId: string) {
        // Obtener roles y datos del aprobador
        const aprobador = await this.prisma.usuario.findUnique({
            where: { id: aprobadorId },
            include: {
                roles: {
                    include: {
                        rol: true
                    }
                },
                profesor: {
                    include: {
                        cursos: true
                    }
                }
            }
        });

        if (!aprobador) {
            throw new NotFoundException(`Usuario con ID ${aprobadorId} no encontrado`);
        }

        const rolesAprobador = aprobador.roles.map(r => r.rol.nombre);

        // Si es administrador, obtener todas las solicitudes de profesores
        if (rolesAprobador.includes('admin')) {
            const solicitudesPerfil = await this.prisma.estadoAprobacion.findMany({
                where: {
                    estadoActual: 'PENDIENTE',
                    usuario: {
                        roles: {
                            some: {
                                rol: {
                                    nombre: 'profesor'
                                }
                            }
                        }
                    }
                },
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

            return { solicitudesPerfil, solicitudesVinculacion: [] };
        }

        // Si es profesor tutor, obtener solicitudes de padres y estudiantes de sus cursos
        if (rolesAprobador.includes('profesor') && aprobador.profesor) {
            const cursosTutor = aprobador.profesor.cursos
                .filter(c => c.esTutor)
                .map(c => c.cursoId);

            if (cursosTutor.length === 0) {
                return { solicitudesPerfil: [], solicitudesVinculacion: [] };
            }

            // Solicitudes de perfil de estudiantes de sus cursos
            const solicitudesPerfil = await this.prisma.estadoAprobacion.findMany({
                where: {
                    estadoActual: 'PENDIENTE',
                    usuario: {
                        OR: [
                            {
                                estudiante: {
                                    cursoId: {
                                        in: cursosTutor
                                    }
                                }
                            },
                            {
                                padres: {
                                    hijos: {
                                        some: {
                                            estudiante: {
                                                cursoId: {
                                                    in: cursosTutor
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        ]
                    }
                },
                include: {
                    usuario: {
                        include: {
                            roles: {
                                include: {
                                    rol: true
                                }
                            },
                            estudiante: true,
                            padres: true
                        }
                    }
                }
            });

            // Solicitudes de vinculación padre-estudiante
            const solicitudesVinculacion = await this.prisma.padreEstudiante.findMany({
                where: {
                    estadoVinculacion: 'PENDIENTE',
                    estudiante: {
                        cursoId: {
                            in: cursosTutor
                        }
                    }
                },
                include: {
                    padre: {
                        include: {
                            usuario: true
                        }
                    },
                    estudiante: {
                        include: {
                            usuario: true,
                            curso: true
                        }
                    }
                }
            });

            return { solicitudesPerfil, solicitudesVinculacion };
        }

        return { solicitudesPerfil: [], solicitudesVinculacion: [] };
    }
}