// src/aprobaciones/aprobaciones.service.ts - principales métodos modificados

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionService } from '../notificacion/notificacion.service';
import { ResolverAprobacionDto } from './dto/resolver-aprobacion.dto';

@Injectable()
export class AprobacionesService {
    private readonly logger = new Logger(AprobacionesService.name);

    constructor(
        private prisma: PrismaService,
        private notificacionService: NotificacionService
    ) { }

    /**
     * Solicita la aprobación de un rol específico de usuario
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

        // Verificar que el usuario tiene asignado ese rol
        const usuarioRol = await this.prisma.usuarioRol.findUnique({
            where: {
                usuarioId_rolId: {
                    usuarioId,
                    rolId
                }
            }
        });

        if (!usuarioRol) {
            throw new NotFoundException(`El usuario no tiene asignado el rol especificado`);
        }

        // Verificar si ya tiene una solicitud pendiente para este rol
        if (usuarioRol.estadoAprobacion === 'PENDIENTE') {
            throw new BadRequestException('El usuario ya tiene una solicitud pendiente para este rol');
        } else if (usuarioRol.estadoAprobacion === 'APROBADO') {
            throw new BadRequestException('El usuario ya está aprobado para este rol');
        }

        // Actualizar el estado de aprobación a PENDIENTE
        const rolActualizado = await this.prisma.usuarioRol.update({
            where: {
                usuarioId_rolId: {
                    usuarioId,
                    rolId
                }
            },
            data: {
                estadoAprobacion: 'PENDIENTE'
            }
        });

        // Notificación según el tipo de rol
        switch (rol.nombre.toLowerCase()) {
            case 'profesor':
                await this.notificarAdministradores(
                    `Solicitud de aprobación de profesor`,
                    `El profesor con ID ${usuarioId} solicita aprobación para el rol ${rol.nombre}`
                );
                break;
            case 'estudiante':
                await this.notificarTutoresCurso(
                    usuarioId,
                    `Solicitud de aprobación de estudiante`,
                    `El estudiante con ID ${usuarioId} solicita aprobación para el rol ${rol.nombre}`
                );
                break;
            case 'padre':
            case 'padre_familia':
                await this.notificarTutoresPadre(
                    usuarioId,
                    `Solicitud de aprobación de padre`,
                    `El padre con ID ${usuarioId} solicita aprobación para el rol ${rol.nombre}`
                );
                break;
            // Otros casos...
        }

        return rolActualizado;
    }

    /**
     * Resuelve una solicitud de aprobación de rol (aprobar o rechazar)
     */
    async resolverAprobacionRol(
        usuarioId: string,
        rolId: number,
        aprobadorId: string,
        data: ResolverAprobacionDto
    ) {
        // Verificar que el usuario y rol existen
        const usuarioRol = await this.prisma.usuarioRol.findUnique({
            where: {
                usuarioId_rolId: {
                    usuarioId,
                    rolId
                }
            },
            include: {
                usuario: true,
                rol: true
            }
        });

        if (!usuarioRol) {
            throw new NotFoundException(`No se encontró el rol ${rolId} para el usuario ${usuarioId}`);
        }

        if (usuarioRol.estadoAprobacion !== 'PENDIENTE') {
            throw new BadRequestException(`La solicitud ya fue ${usuarioRol.estadoAprobacion.toLowerCase()}`);
        }

        // Verificar que el aprobador tiene permisos para aprobar
        const puedeAprobar = await this.puedeAprobarRol(aprobadorId, usuarioId, rolId);
        if (!puedeAprobar) {
            throw new BadRequestException('No tiene permisos para aprobar esta solicitud');
        }

        // Actualizar estado de aprobación
        const nuevoEstado = data.aprobado ? 'APROBADO' : 'RECHAZADO';

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
                comentarios: data.comentarios
            }
        });

        // Notificar al usuario sobre la resolución
        await this.notificacionService.create({
            usuarioReceptorId: usuarioId,
            titulo: `Rol ${usuarioRol.rol.nombre} ${nuevoEstado.toLowerCase()}`,
            mensaje: data.comentarios || `Su solicitud para el rol ${usuarioRol.rol.nombre} ha sido ${nuevoEstado.toLowerCase()}`,
            tipo: data.aprobado ? 'EXITO' : 'ALERTA'
        });

        return rolActualizado;
    }

    /**
     * Verifica si un usuario tiene un rol específico aprobado
     */
    async verificarRolAprobado(usuarioId: string, rolNombre: string): Promise<boolean> {
        const usuarioRol = await this.prisma.usuarioRol.findFirst({
            where: {
                usuarioId,
                rol: {
                    nombre: {
                        equals: rolNombre,
                        mode: 'insensitive'
                    }
                },
                estadoAprobacion: 'APROBADO'
            }
        });

        return !!usuarioRol;
    }

    /**
     * Verifica si un usuario puede aprobar a otro para un rol específico
     */
    async puedeAprobarRol(aprobadorId: string, usuarioId: string, rolId: number): Promise<boolean> {
        // Obtener datos del aprobador
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

        // Obtener datos del rol a aprobar
        const rolInfo = await this.prisma.rol.findUnique({
            where: { id: rolId }
        });

        if (!rolInfo) {
            return false;
        }

        // Obtener datos del usuario a aprobar
        const usuario = await this.prisma.usuario.findUnique({
            where: { id: usuarioId },
            include: {
                estudiante: true
            }
        });

        if (!usuario) {
            return false;
        }

        // Verificar si el aprobador es administrador (puede aprobar cualquier rol)
        const esAdmin = aprobador.roles.some(r => r.rol.nombre.toLowerCase() === 'admin');
        if (esAdmin) {
            return true;
        }

        // Lógica específica por tipo de rol
        switch (rolInfo.nombre.toLowerCase()) {
            case 'estudiante':
                // Solo profesores tutores pueden aprobar estudiantes de su curso
                if (usuario.estudiante && aprobador.profesor) {
                    return aprobador.profesor.cursos.some(c =>
                        c.cursoId === usuario.estudiante.cursoId && c.esTutor
                    );
                }
                break;
            case 'padre':
            case 'padre_familia':
                // Solo profesores tutores de los hijos pueden aprobar padres
                if (aprobador.profesor) {
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
                break;
            case 'profesor':
                // Solo administradores pueden aprobar profesores (ya verificado arriba)
                return false;
            // Otros casos...
        }

        return false;
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

        const rolesAprobador = aprobador.roles.map(r => r.rol.nombre.toLowerCase());
        const solicitudesPendientes = [];

        // Si es administrador, obtener todas las solicitudes de profesores
        if (rolesAprobador.includes('admin')) {
            const solicitudesProfesores = await this.prisma.usuarioRol.findMany({
                where: {
                    estadoAprobacion: 'PENDIENTE',
                    rol: {
                        nombre: {
                            equals: 'profesor',
                            mode: 'insensitive'
                        }
                    }
                },
                include: {
                    usuario: true,
                    rol: true
                }
            });

            solicitudesPendientes.push(...solicitudesProfesores);
        }

        // Si es profesor tutor, obtener solicitudes de padres y estudiantes de sus cursos
        if (rolesAprobador.includes('profesor') && aprobador.profesor) {
            const cursosTutor = aprobador.profesor.cursos
                .filter(c => c.esTutor)
                .map(c => c.cursoId);

            if (cursosTutor.length > 0) {
                // Solicitudes de estudiantes de sus cursos
                const solicitudesEstudiantes = await this.prisma.usuarioRol.findMany({
                    where: {
                        estadoAprobacion: 'PENDIENTE',
                        rol: {
                            nombre: {
                                equals: 'estudiante',
                                mode: 'insensitive'
                            }
                        },
                        usuario: {
                            estudiante: {
                                cursoId: {
                                    in: cursosTutor
                                }
                            }
                        }
                    },
                    include: {
                        usuario: {
                            include: {
                                estudiante: true
                            }
                        },
                        rol: true
                    }
                });

                solicitudesPendientes.push(...solicitudesEstudiantes);

                // Solicitudes de padres con hijos en sus cursos
                const solicitudesPadres = await this.prisma.usuarioRol.findMany({
                    where: {
                        estadoAprobacion: 'PENDIENTE',
                        rol: {
                            nombre: {
                                in: ['padre', 'padre_familia'],
                                mode: 'insensitive'
                            }
                        },
                        usuario: {
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
                    },
                    include: {
                        usuario: {
                            include: {
                                padres: true
                            }
                        },
                        rol: true
                    }
                });

                solicitudesPendientes.push(...solicitudesPadres);
            }
        }

        return solicitudesPendientes;
    }

    // Métodos auxiliares de notificación (mismos que en el código original)
    private async notificarAdministradores(titulo: string, mensaje: string) {
        // Implementación...
    }

    private async notificarTutoresCurso(estudianteId: string, titulo: string, mensaje: string) {
        // Implementación...
    }

    private async notificarTutoresPadre(padreId: string, titulo: string, mensaje: string) {
        // Implementación...
    }
}