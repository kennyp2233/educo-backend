// src/aprobaciones/aprobaciones.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionService } from '../notificacion/notificacion.service';
import { SolicitarAprobacionDto, TipoAprobacion } from './dto/solicitar-aprobacion.dto';
import { ResolverAprobacionDto } from './dto/resolver-aprobacion.dto';

@Injectable()
export class AprobacionesService {
    private readonly logger = new Logger(AprobacionesService.name);

    constructor(
        private prisma: PrismaService,
        private notificacionService: NotificacionService
    ) { }

    /**
     * Solicitar una aprobación genérica
     */
    async solicitarAprobacion(solicitudDto: SolicitarAprobacionDto) {
        switch (solicitudDto.tipoAprobacion) {
            case TipoAprobacion.ROL_USUARIO:
                return this.solicitarAprobacionRol(solicitudDto.usuarioId, solicitudDto.rolId);
            case TipoAprobacion.VINCULACION_PADRE_ESTUDIANTE:
                return this.solicitarVinculacion({
                    padreId: solicitudDto.padreId,
                    estudianteId: solicitudDto.estudianteId,
                    esRepresentante: solicitudDto.esRepresentante
                });
            case TipoAprobacion.PERMISO:
                return this.solicitarAprobacionPermiso(solicitudDto.permisoId);
            default:
                throw new BadRequestException(`Tipo de aprobación no soportado: ${solicitudDto.tipoAprobacion}`);
        }
    }

    /**
     * Solicitar aprobación de un rol de usuario
     */
    async solicitarAprobacionRol(usuarioId: string, rolId: number) {
        // Verificar que el usuario existe
        const usuario = await this.prisma.usuario.findUnique({
            where: { id: usuarioId }
        });

        if (!usuario) {
            throw new NotFoundException(`Usuario con ID ${usuarioId} no encontrado`);
        }

        // Verificar que el rol existe
        const rol = await this.prisma.rol.findUnique({
            where: { id: rolId }
        });

        if (!rol) {
            throw new NotFoundException(`Rol con ID ${rolId} no encontrado`);
        }

        // Verificar si el usuario ya tiene asignado ese rol
        const usuarioRol = await this.prisma.usuarioRol.findUnique({
            where: {
                usuarioId_rolId: {
                    usuarioId,
                    rolId
                }
            }
        });

        // Si ya existe el rol pero está en otro estado que no es PENDIENTE
        if (usuarioRol && usuarioRol.estadoAprobacion !== 'PENDIENTE') {
            // Si ya está aprobado, no hace falta hacer nada
            if (usuarioRol.estadoAprobacion === 'APROBADO') {
                throw new BadRequestException(`El usuario ya tiene el rol ${rol.nombre} aprobado`);
            }

            // Si está rechazado, actualizamos a pendiente
            return this.prisma.usuarioRol.update({
                where: {
                    usuarioId_rolId: {
                        usuarioId,
                        rolId
                    }
                },
                data: {
                    estadoAprobacion: 'PENDIENTE',
                    aprobadorId: null,
                    fechaAprobacion: null,
                    comentarios: null
                },
                include: {
                    rol: true
                }
            });
        }

        // Si no existe, lo creamos con estado PENDIENTE
        if (!usuarioRol) {
            const nuevoUsuarioRol = await this.prisma.usuarioRol.create({
                data: {
                    usuarioId,
                    rolId,
                    estadoAprobacion: 'PENDIENTE'
                },
                include: {
                    rol: true
                }
            });

            // Notificar a los administradores sobre la nueva solicitud
            await this.notificarAdmins(
                `Nueva solicitud de rol: ${rol.nombre}`,
                `El usuario ${usuarioId} ha solicitado el rol ${rol.nombre}`
            );

            return nuevoUsuarioRol;
        }

        // Si ya está pendiente, devolvemos el usuarioRol actual
        return {
            ...usuarioRol,
            rol
        };
    }

    /**
     * Solicitar vinculación de un padre con un estudiante
     */
    async solicitarVinculacion(data: { padreId: string, estudianteId: string, esRepresentante: boolean }) {
        // Verificar que el padre existe
        const padre = await this.prisma.padre.findUnique({
            where: { usuarioId: data.padreId }
        });

        if (!padre) {
            throw new NotFoundException(`Padre con ID ${data.padreId} no encontrado`);
        }

        // Verificar que el estudiante existe
        const estudiante = await this.prisma.estudiante.findUnique({
            where: { usuarioId: data.estudianteId },
            include: {
                curso: true
            }
        });

        if (!estudiante) {
            throw new NotFoundException(`Estudiante con ID ${data.estudianteId} no encontrado`);
        }

        // Verificar si ya existe una vinculación
        const vinculacionExistente = await this.prisma.padreEstudiante.findUnique({
            where: {
                padreId_estudianteId: {
                    padreId: data.padreId,
                    estudianteId: data.estudianteId
                }
            }
        });

        if (vinculacionExistente) {
            // Si ya está aprobada, no hace falta hacer nada
            if (vinculacionExistente.estadoVinculacion === 'APROBADO') {
                throw new BadRequestException('La vinculación ya está aprobada');
            }

            // Si está en otro estado, actualizamos a pendiente
            return this.prisma.padreEstudiante.update({
                where: {
                    padreId_estudianteId: {
                        padreId: data.padreId,
                        estudianteId: data.estudianteId
                    }
                },
                data: {
                    estadoVinculacion: 'PENDIENTE',
                    esRepresentante: data.esRepresentante
                }
            });
        }

        // Si no existe, la creamos
        const nuevaVinculacion = await this.prisma.padreEstudiante.create({
            data: {
                padreId: data.padreId,
                estudianteId: data.estudianteId,
                esRepresentante: data.esRepresentante,
                estadoVinculacion: 'PENDIENTE'
            }
        });

        // Notificar a los tutores del curso
        await this.notificarTutoresCurso(
            estudiante.cursoId,
            'Nueva solicitud de vinculación',
            `Un padre solicita vincularse con el estudiante ${data.estudianteId} del curso ${estudiante.curso.nombre}`
        );

        return nuevaVinculacion;
    }

    /**
     * Solicitar aprobación de un permiso
     */
    async solicitarAprobacionPermiso(permisoId: number) {
        // Verificar que el permiso existe
        const permiso = await this.prisma.permiso.findUnique({
            where: { id: permisoId }
        });

        if (!permiso) {
            throw new NotFoundException(`Permiso con ID ${permisoId} no encontrado`);
        }

        // Si ya está en un estado diferente a PENDIENTE
        if (permiso.estado !== 'PENDIENTE') {
            throw new BadRequestException(`El permiso ya está en estado ${permiso.estado}`);
        }

        // Notificar a los tutores del curso
        await this.notificarTutoresCurso(
            permiso.cursoId,
            'Nuevo permiso pendiente',
            `Hay un nuevo permiso solicitado por el padre ${permiso.padreId}`
        );

        return permiso;
    }

    /**
     * Resolver una aprobación de rol
     */
    async resolverAprobacionRol(
        usuarioId: string,
        rolId: number,
        aprobadorId: string,
        dto: ResolverAprobacionDto
    ) {
        // Verificar que existe la asignación de rol
        const usuarioRol = await this.prisma.usuarioRol.findUnique({
            where: {
                usuarioId_rolId: {
                    usuarioId,
                    rolId
                }
            },
            include: {
                rol: true,
                usuario: true
            }
        });

        if (!usuarioRol) {
            throw new NotFoundException(`No se encontró asignación del rol ${rolId} al usuario ${usuarioId}`);
        }

        if (usuarioRol.estadoAprobacion !== 'PENDIENTE') {
            throw new BadRequestException(`La solicitud ya fue ${usuarioRol.estadoAprobacion.toLowerCase()}`);
        }

        // Verificar que el aprobador puede aprobar este rol
        const puedeAprobar = await this.verificarPermisosAprobacion(aprobadorId, usuarioId, rolId);
        if (!puedeAprobar) {
            throw new BadRequestException('No tiene permisos para aprobar esta solicitud');
        }

        // Actualizar el estado de la aprobación
        const nuevoEstado = dto.aprobado ? 'APROBADO' : 'RECHAZADO';
        const rolActualizado = await this.prisma.usuarioRol.update({
            where: {
                usuarioId_rolId: {
                    usuarioId,
                    rolId
                }
            },
            data: {
                estadoAprobacion: nuevoEstado,
                aprobadorId,
                fechaAprobacion: new Date(),
                comentarios: dto.comentarios
            },
            include: {
                rol: true
            }
        });

        // Notificar al usuario sobre la resolución
        await this.notificacionService.create({
            usuarioReceptorId: usuarioId,
            titulo: `Rol ${usuarioRol.rol.nombre} ${nuevoEstado.toLowerCase()}`,
            mensaje: dto.comentarios || `Su solicitud para el rol ${usuarioRol.rol.nombre} ha sido ${nuevoEstado.toLowerCase()}`,
            tipo: dto.aprobado ? 'EXITO' : 'ALERTA'
        });

        return rolActualizado;
    }

    /**
     * Resolver una vinculación padre-estudiante
     */
    async resolverVinculacion(
        padreId: string,
        estudianteId: string,
        aprobadorId: string,
        dto: ResolverAprobacionDto
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
            throw new NotFoundException(`No se encontró vinculación entre padre ${padreId} y estudiante ${estudianteId}`);
        }

        if (vinculacion.estadoVinculacion !== 'PENDIENTE') {
            throw new BadRequestException(`La vinculación ya fue ${vinculacion.estadoVinculacion.toLowerCase()}`);
        }

        // Verificar que el aprobador puede aprobar esta vinculación (debe ser tutor del curso)
        const puedeAprobar = await this.verificarPermisosTutor(aprobadorId, vinculacion.estudiante.cursoId);
        if (!puedeAprobar) {
            throw new BadRequestException('No tiene permisos para aprobar esta vinculación');
        }

        // Actualizar el estado de la vinculación
        const nuevoEstado = dto.aprobado ? 'APROBADO' : 'RECHAZADO';
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
            },
            include: {
                estudiante: true
            }
        });

        // Notificar al padre sobre la resolución
        await this.notificacionService.create({
            usuarioReceptorId: padreId,
            titulo: `Vinculación ${nuevoEstado.toLowerCase()}`,
            mensaje: dto.comentarios || `Su solicitud de vinculación con el estudiante ha sido ${nuevoEstado.toLowerCase()}`,
            tipo: dto.aprobado ? 'EXITO' : 'ALERTA'
        });

        return vinculacionActualizada;
    }

    /**
     * Resolver aprobación de un permiso
     */
    async resolverPermiso(
        permisoId: number,
        aprobadorId: string,
        dto: ResolverAprobacionDto
    ) {
        // Verificar que existe el permiso
        const permiso = await this.prisma.permiso.findUnique({
            where: { id: permisoId }
        });

        if (!permiso) {
            throw new NotFoundException(`Permiso con ID ${permisoId} no encontrado`);
        }

        if (permiso.estado !== 'PENDIENTE') {
            throw new BadRequestException(`El permiso ya está en estado ${permiso.estado}`);
        }

        // Verificar que el aprobador puede aprobar este permiso (debe ser tutor del curso)
        const puedeAprobar = await this.verificarPermisosTutor(aprobadorId, permiso.cursoId);
        if (!puedeAprobar) {
            throw new BadRequestException('No tiene permisos para aprobar este permiso');
        }

        // Actualizar el estado del permiso
        const nuevoEstado = dto.aprobado ? 'APROBADO' : 'RECHAZADO';

        // Si se aprueba, generamos código QR único
        const codigoQR = dto.aprobado ? this.generarCodigoQR() : null;

        const permisoActualizado = await this.prisma.permiso.update({
            where: { id: permisoId },
            data: {
                estado: nuevoEstado,
                aprobadorId,
                fechaAprobacion: new Date(),
                codigoQR
            }
        });

        // Notificar al padre sobre la resolución
        await this.notificacionService.create({
            usuarioReceptorId: permiso.padreId,
            titulo: `Permiso ${nuevoEstado.toLowerCase()}`,
            mensaje: dto.comentarios || `Su solicitud de permiso ha sido ${nuevoEstado.toLowerCase()}`,
            tipo: dto.aprobado ? 'EXITO' : 'ALERTA'
        });

        return permisoActualizado;
    }

    /**
     * Obtener todas las solicitudes pendientes que puede aprobar un usuario
     */
    async obtenerSolicitudesPendientes(aprobadorId: string) {
        // Determinar roles del aprobador
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

        const esAdmin = aprobador.roles.some(r => r.rol.nombre.toLowerCase() === 'admin');
        const esTutor = aprobador.profesor?.cursos.some(c => c.esTutor) || false;

        const resultado = {
            roles: [],
            vinculaciones: [],
            permisos: []
        };

        // Si es admin, obtener solicitudes de roles pendientes
        if (esAdmin) {
            resultado.roles = await this.prisma.usuarioRol.findMany({
                where: {
                    estadoAprobacion: 'PENDIENTE'
                },
                include: {
                    usuario: true,
                    rol: true
                }
            });
        }

        // Si es tutor, obtener solicitudes que afecten a sus cursos
        if (esTutor && aprobador.profesor) {
            const cursosTutor = aprobador.profesor.cursos
                .filter(c => c.esTutor)
                .map(c => c.cursoId);

            // Vinculaciones pendientes para estudiantes de sus cursos
            resultado.vinculaciones = await this.prisma.padreEstudiante.findMany({
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

            // Permisos pendientes para sus cursos
            resultado.permisos = await this.prisma.permiso.findMany({
                where: {
                    estado: 'PENDIENTE',
                    cursoId: {
                        in: cursosTutor
                    }
                },
                include: {
                    padre: {
                        include: {
                            usuario: true
                        }
                    },
                    curso: true,
                    estudiante: {
                        include: {
                            usuario: true
                        }
                    }
                }
            });
        }

        return resultado;
    }

    /**
     * Obtener el ID de una solicitud de vinculación entre padre y estudiante
     */
    async obtenerSolicitudVinculacion(padreId: string, estudianteId: string) {
        const vinculacion = await this.prisma.padreEstudiante.findUnique({
            where: {
                padreId_estudianteId: {
                    padreId,
                    estudianteId
                }
            }
        });

        if (!vinculacion) {
            return null;
        }

        return {
            padreId: vinculacion.padreId,
            estudianteId: vinculacion.estudianteId
        };
    }

    /**
     * Verificar si un usuario tiene permisos para aprobar un rol
     */
    private async verificarPermisosAprobacion(
        aprobadorId: string,
        usuarioId: string,
        rolId: number
    ): Promise<boolean> {
        // Obtener información del aprobador
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

        // Obtener información del rol a aprobar
        const rol = await this.prisma.rol.findUnique({
            where: { id: rolId }
        });

        if (!rol) {
            return false;
        }

        // Si es administrador, puede aprobar cualquier rol
        const esAdmin = aprobador.roles.some(r => r.rol.nombre.toLowerCase() === 'admin');
        if (esAdmin) {
            return true;
        }

        // Casos específicos por tipo de rol
        switch (rol.nombre.toLowerCase()) {
            case 'estudiante':
                // Verificar si el usuario a aprobar tiene un perfil de estudiante
                const estudiante = await this.prisma.estudiante.findUnique({
                    where: { usuarioId }
                });

                // Solo tutores del curso pueden aprobar estudiantes
                if (estudiante && aprobador.profesor) {
                    return aprobador.profesor.cursos.some(c =>
                        c.cursoId === estudiante.cursoId && c.esTutor
                    );
                }
                break;

            case 'padre':
            case 'padre_familia':
                // Verificar si el aprobador es tutor de algún hijo del padre
                const padreEstudiante = await this.prisma.padreEstudiante.findMany({
                    where: { padreId: usuarioId },
                    include: { estudiante: true }
                });

                if (padreEstudiante.length > 0 && aprobador.profesor) {
                    const cursosTutor = aprobador.profesor.cursos
                        .filter(c => c.esTutor)
                        .map(c => c.cursoId);

                    return padreEstudiante.some(pe =>
                        cursosTutor.includes(pe.estudiante.cursoId)
                    );
                }
                break;
        }

        return false;
    }

    /**
     * Verificar si un usuario es tutor de un curso
     */
    private async verificarPermisosTutor(usuarioId: string, cursoId: number): Promise<boolean> {
        // Verificar si el usuario es un profesor tutor para este curso
        const profesorCurso = await this.prisma.profesorCurso.findUnique({
            where: {
                profesorId_cursoId: {
                    profesorId: usuarioId,
                    cursoId
                }
            }
        });

        return profesorCurso?.esTutor || false;
    }

    /**
     * Notificar a todos los administradores
     */
    private async notificarAdmins(titulo: string, mensaje: string) {
        // Buscar todos los usuarios con rol admin
        const admins = await this.prisma.usuarioRol.findMany({
            where: {
                rol: {
                    nombre: {
                        equals: 'admin',
                        mode: 'insensitive'
                    }
                },
                estadoAprobacion: 'APROBADO'
            },
            select: {
                usuarioId: true
            }
        });

        // Notificar a cada admin
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
     * Notificar a todos los tutores de un curso
     */
    private async notificarTutoresCurso(cursoId: number, titulo: string, mensaje: string) {
        // Buscar todos los profesores tutores del curso
        const tutores = await this.prisma.profesorCurso.findMany({
            where: {
                cursoId,
                esTutor: true
            },
            select: {
                profesorId: true
            }
        });

        // Notificar a cada tutor
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
     * Generar un código QR único (simulado)
     */
    private generarCodigoQR(): string {
        return `QR-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }
}