// src/notificacion/notificacion.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Notificacion } from '@prisma/client';
import { CreateNotificacionDto } from './dto/create-notificacion.dto';
import { UpdateNotificacionDto } from './dto/update-notificacion.dto';

@Injectable()
export class NotificacionService {
    private readonly logger = new Logger(NotificacionService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Obtener todas las notificaciones
     */
    async findAll(): Promise<Notificacion[]> {
        return this.prisma.notificacion.findMany({
            include: {
                usuarioReceptor: true
            }
        });
    }

    /**
     * Obtener notificaciones por usuario
     */
    async findByUsuario(usuarioId: string): Promise<Notificacion[]> {
        return this.prisma.notificacion.findMany({
            where: { usuarioReceptorId: usuarioId },
            orderBy: {
                fecha: 'desc'
            }
        });
    }

    /**
     * Obtener notificaciones no leídas por usuario
     */
    async findNoLeidasByUsuario(usuarioId: string): Promise<Notificacion[]> {
        return this.prisma.notificacion.findMany({
            where: {
                usuarioReceptorId: usuarioId,
                leida: false
            },
            orderBy: {
                fecha: 'desc'
            }
        });
    }

    /**
     * Obtener una notificación por ID
     */
    async findOne(id: number): Promise<Notificacion> {
        const notificacion = await this.prisma.notificacion.findUnique({
            where: { id },
            include: {
                usuarioReceptor: true
            }
        });

        if (!notificacion) {
            throw new NotFoundException(`Notificación con ID ${id} no encontrada`);
        }

        return notificacion;
    }

    /**
     * Crear una nueva notificación
     */
    async create(createNotificacionDto: CreateNotificacionDto): Promise<Notificacion> {
        // Verificar que el usuario existe
        const usuario = await this.prisma.usuario.findUnique({
            where: { id: createNotificacionDto.usuarioReceptorId }
        });

        if (!usuario) {
            throw new NotFoundException(`Usuario con ID ${createNotificacionDto.usuarioReceptorId} no encontrado`);
        }

        return this.prisma.notificacion.create({
            data: {
                ...createNotificacionDto,
                fecha: new Date(),
                leida: false
            }
        });
    }

    /**
     * Enviar notificación a múltiples usuarios
     */
    async crearMultiples(usuarioIds: string[],
        notificacionBase: { titulo: string; mensaje: string; tipo: string }
    ): Promise<Notificacion[]> {
        const notificaciones = [];

        for (const usuarioId of usuarioIds) {
            try {
                const notificacion = await this.create({
                    usuarioReceptorId: usuarioId,
                    titulo: notificacionBase.titulo,
                    mensaje: notificacionBase.mensaje,
                    tipo: notificacionBase.tipo
                });
                notificaciones.push(notificacion);
            } catch (error) {
                this.logger.error(`Error al crear notificación para usuario ${usuarioId}: ${error.message}`);
            }
        }

        return notificaciones;
    }

    /**
     * Marcar una notificación como leída
     */
    async marcarComoLeida(id: number): Promise<Notificacion> {
        const notificacion = await this.prisma.notificacion.findUnique({
            where: { id }
        });

        if (!notificacion) {
            throw new NotFoundException(`Notificación con ID ${id} no encontrada`);
        }

        return this.prisma.notificacion.update({
            where: { id },
            data: {
                leida: true
            }
        });
    }

    /**
     * Marcar todas las notificaciones de un usuario como leídas
     */
    async marcarTodasComoLeidas(usuarioId: string): Promise<{ count: number }> {
        const result = await this.prisma.notificacion.updateMany({
            where: {
                usuarioReceptorId: usuarioId,
                leida: false
            },
            data: {
                leida: true
            }
        });

        return { count: result.count };
    }

    /**
     * Actualizar una notificación
     */
    async update(id: number, updateNotificacionDto: UpdateNotificacionDto): Promise<Notificacion> {
        const notificacion = await this.prisma.notificacion.findUnique({
            where: { id }
        });

        if (!notificacion) {
            throw new NotFoundException(`Notificación con ID ${id} no encontrada`);
        }

        return this.prisma.notificacion.update({
            where: { id },
            data: updateNotificacionDto
        });
    }

    /**
     * Eliminar una notificación
     */
    async remove(id: number): Promise<Notificacion> {
        try {
            return await this.prisma.notificacion.delete({
                where: { id }
            });
        } catch (error) {
            this.logger.error(`Error al eliminar notificación ${id}: ${error.message}`);
            throw new NotFoundException(`Notificación con ID ${id} no encontrada`);
        }
    }

    /**
     * Eliminar todas las notificaciones leídas de un usuario
     */
    async eliminarNotificacionesLeidas(usuarioId: string): Promise<{ count: number }> {
        const result = await this.prisma.notificacion.deleteMany({
            where: {
                usuarioReceptorId: usuarioId,
                leida: true
            }
        });

        return { count: result.count };
    }
}