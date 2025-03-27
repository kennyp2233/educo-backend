// src/recaudacion/recaudacion.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Recaudacion, Abono } from '@prisma/client';
import { CreateRecaudacionDto } from './dto/create-recaudacion.dto';
import { UpdateRecaudacionDto } from './dto/update-recaudacion.dto';
import { CreateAbonoDto } from './dto/create-abono.dto';
import { UpdateAbonoDto } from './dto/update-abono.dto';

@Injectable()
export class RecaudacionService {
    private readonly logger = new Logger(RecaudacionService.name);

    constructor(private prisma: PrismaService) { }

    // ========== Métodos de Recaudación ==========

    /**
     * Obtener todas las recaudaciones
     */
    async findAllRecaudaciones(): Promise<Recaudacion[]> {
        return this.prisma.recaudacion.findMany({
            include: {
                tesorero: true,
                abonos: true
            }
        });
    }

    /**
     * Obtener recaudaciones por tesorero
     */
    async findRecaudacionesByTesorero(tesoreroId: string): Promise<Recaudacion[]> {
        return this.prisma.recaudacion.findMany({
            where: { tesoreroId },
            include: {
                abonos: true
            }
        });
    }

    /**
     * Obtener una recaudación por ID
     */
    async findRecaudacionById(id: number): Promise<Recaudacion> {
        const recaudacion = await this.prisma.recaudacion.findUnique({
            where: { id },
            include: {
                tesorero: true,
                abonos: {
                    include: {
                        padre: true,
                        estudiante: true
                    }
                }
            }
        });

        if (!recaudacion) {
            throw new NotFoundException(`Recaudación con ID ${id} no encontrada`);
        }

        return recaudacion;
    }

    /**
     * Crear una nueva recaudación
     */
    async createRecaudacion(data: CreateRecaudacionDto): Promise<Recaudacion> {
        // Verificar que el tesorero existe
        const tesorero = await this.prisma.tesorero.findUnique({
            where: { usuarioId: data.tesoreroId },
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

        if (!tesorero) {
            throw new NotFoundException(`Tesorero con ID ${data.tesoreroId} no encontrado`);
        }

        // Verificar que el tesorero tiene rol aprobado
        const rolAprobado = tesorero.usuario.roles.some(r =>
            r.rol.nombre.toLowerCase() === 'tesorero' &&
            r.estadoAprobacion === 'APROBADO'
        );


        if (!rolAprobado) {
            throw new BadRequestException('El tesorero no está aprobado para realizar esta acción');
        }

        // Verificar que las fechas son válidas
        if (new Date(data.fechaInicio) >= new Date(data.fechaCierre)) {
            throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de cierre');
        }

        return this.prisma.recaudacion.create({
            data: {
                ...data,
                estado: 'ACTIVA' // Estado inicial
            }
        });
    }

    /**
     * Actualizar una recaudación
     */
    async updateRecaudacion(id: number, data: UpdateRecaudacionDto): Promise<Recaudacion> {
        // Verificar que la recaudación existe
        const recaudacionExistente = await this.prisma.recaudacion.findUnique({
            where: { id }
        });

        if (!recaudacionExistente) {
            throw new NotFoundException(`Recaudación con ID ${id} no encontrada`);
        }

        // Si se está actualizando las fechas, validarlas
        if (data.fechaInicio && data.fechaCierre) {
            const fechaInicio = new Date(data.fechaInicio);
            const fechaCierre = new Date(data.fechaCierre);

            if (fechaInicio >= fechaCierre) {
                throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de cierre');
            }
        } else if (data.fechaInicio && !data.fechaCierre) {
            const fechaInicio = new Date(data.fechaInicio);
            const fechaCierre = new Date(recaudacionExistente.fechaCierre);

            if (fechaInicio >= fechaCierre) {
                throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de cierre');
            }
        } else if (!data.fechaInicio && data.fechaCierre) {
            const fechaInicio = new Date(recaudacionExistente.fechaInicio);
            const fechaCierre = new Date(data.fechaCierre);

            if (fechaInicio >= fechaCierre) {
                throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de cierre');
            }
        }

        try {
            return await this.prisma.recaudacion.update({
                where: { id },
                data
            });
        } catch (error) {
            this.logger.error(`Error al actualizar recaudación ${id}: ${error.message}`);
            throw new BadRequestException(`Error al actualizar recaudación: ${error.message}`);
        }
    }

    /**
     * Cerrar una recaudación
     */
    async cerrarRecaudacion(id: number): Promise<Recaudacion> {
        // Verificar que la recaudación existe
        const recaudacion = await this.prisma.recaudacion.findUnique({
            where: { id }
        });

        if (!recaudacion) {
            throw new NotFoundException(`Recaudación con ID ${id} no encontrada`);
        }

        if (recaudacion.estado === 'CERRADA') {
            throw new BadRequestException('La recaudación ya está cerrada');
        }

        return this.prisma.recaudacion.update({
            where: { id },
            data: {
                estado: 'CERRADA'
            }
        });
    }

    /**
     * Eliminar una recaudación
     */
    async deleteRecaudacion(id: number): Promise<Recaudacion> {
        try {
            return await this.prisma.recaudacion.delete({
                where: { id }
            });
        } catch (error) {
            this.logger.error(`Error al eliminar recaudación ${id}: ${error.message}`);
            throw new BadRequestException(`Error al eliminar recaudación: ${error.message}`);
        }
    }

    // ========== Métodos de Abono ==========

    /**
     * Obtener todos los abonos de una recaudación
     */
    async findAbonosByRecaudacion(recaudacionId: number): Promise<Abono[]> {
        return this.prisma.abono.findMany({
            where: { recaudacionId },
            include: {
                padre: true,
                estudiante: true
            }
        });
    }

    /**
     * Obtener abonos por padre
     */
    async findAbonosByPadre(padreId: string): Promise<Abono[]> {
        return this.prisma.abono.findMany({
            where: { padreId },
            include: {
                recaudacion: true,
                estudiante: true
            }
        });
    }

    /**
     * Obtener abonos por estudiante
     */
    async findAbonosByEstudiante(estudianteId: string): Promise<Abono[]> {
        return this.prisma.abono.findMany({
            where: { estudianteId },
            include: {
                recaudacion: true,
                padre: true
            }
        });
    }

    /**
     * Obtener un abono por ID
     */
    async findAbonoById(id: number): Promise<Abono> {
        const abono = await this.prisma.abono.findUnique({
            where: { id },
            include: {
                recaudacion: true,
                padre: true,
                estudiante: true
            }
        });

        if (!abono) {
            throw new NotFoundException(`Abono con ID ${id} no encontrado`);
        }

        return abono;
    }

    /**
     * Crear un nuevo abono
     */
    async createAbono(data: CreateAbonoDto): Promise<Abono> {
        // Verificar que la recaudación existe y está activa
        const recaudacion = await this.prisma.recaudacion.findUnique({
            where: { id: data.recaudacionId }
        });

        if (!recaudacion) {
            throw new NotFoundException(`Recaudación con ID ${data.recaudacionId} no encontrada`);
        }

        if (recaudacion.estado !== 'ACTIVA') {
            throw new BadRequestException('No se puede abonar a una recaudación que no está activa');
        }

        // Verificar que el padre existe
        const padre = await this.prisma.padre.findUnique({
            where: { usuarioId: data.padreId }
        });

        if (!padre) {
            throw new NotFoundException(`Padre con ID ${data.padreId} no encontrado`);
        }

        // Verificar que el estudiante existe
        const estudiante = await this.prisma.estudiante.findUnique({
            where: { usuarioId: data.estudianteId }
        });

        if (!estudiante) {
            throw new NotFoundException(`Estudiante con ID ${data.estudianteId} no encontrado`);
        }

        // Verificar que el estudiante está asignado al padre
        const relacion = await this.prisma.padreEstudiante.findUnique({
            where: {
                padreId_estudianteId: {
                    padreId: data.padreId,
                    estudianteId: data.estudianteId
                }
            }
        });

        if (!relacion) {
            throw new BadRequestException('El estudiante no está asignado a este padre');
        }

        return this.prisma.abono.create({
            data: {
                ...data,
                fechaPago: data.fechaPago || new Date(),
                estado: 'PENDIENTE' // Estado inicial
            }
        });
    }

    /**
     * Actualizar un abono
     */
    async updateAbono(id: number, data: UpdateAbonoDto): Promise<Abono> {
        // Verificar que el abono existe
        const abono = await this.prisma.abono.findUnique({
            where: { id },
            include: {
                recaudacion: true
            }
        });

        if (!abono) {
            throw new NotFoundException(`Abono con ID ${id} no encontrado`);
        }

        // Verificar que la recaudación está activa
        if (abono.recaudacion.estado !== 'ACTIVA') {
            throw new BadRequestException('No se puede modificar un abono de una recaudación que no está activa');
        }

        try {
            return await this.prisma.abono.update({
                where: { id },
                data
            });
        } catch (error) {
            this.logger.error(`Error al actualizar abono ${id}: ${error.message}`);
            throw new BadRequestException(`Error al actualizar abono: ${error.message}`);
        }
    }

    /**
     * Aprobar un abono
     */
    async aprobarAbono(id: number): Promise<Abono> {
        // Verificar que el abono existe
        const abono = await this.prisma.abono.findUnique({
            where: { id },
            include: {
                recaudacion: true
            }
        });

        if (!abono) {
            throw new NotFoundException(`Abono con ID ${id} no encontrado`);
        }

        // Verificar que la recaudación está activa
        if (abono.recaudacion.estado !== 'ACTIVA') {
            throw new BadRequestException('No se puede aprobar un abono de una recaudación que no está activa');
        }

        // Verificar que el abono está pendiente
        if (abono.estado !== 'PENDIENTE') {
            throw new BadRequestException(`El abono no está en estado PENDIENTE, está en estado ${abono.estado}`);
        }

        return this.prisma.abono.update({
            where: { id },
            data: {
                estado: 'APROBADO'
            }
        });
    }

    /**
     * Rechazar un abono
     */
    async rechazarAbono(id: number): Promise<Abono> {
        // Verificar que el abono existe
        const abono = await this.prisma.abono.findUnique({
            where: { id },
            include: {
                recaudacion: true
            }
        });

        if (!abono) {
            throw new NotFoundException(`Abono con ID ${id} no encontrado`);
        }

        // Verificar que la recaudación está activa
        if (abono.recaudacion.estado !== 'ACTIVA') {
            throw new BadRequestException('No se puede rechazar un abono de una recaudación que no está activa');
        }

        // Verificar que el abono está pendiente
        if (abono.estado !== 'PENDIENTE') {
            throw new BadRequestException(`El abono no está en estado PENDIENTE, está en estado ${abono.estado}`);
        }

        return this.prisma.abono.update({
            where: { id },
            data: {
                estado: 'RECHAZADO'
            }
        });
    }

    /**
     * Eliminar un abono
     */
    async deleteAbono(id: number): Promise<Abono> {
        try {
            return await this.prisma.abono.delete({
                where: { id }
            });
        } catch (error) {
            this.logger.error(`Error al eliminar abono ${id}: ${error.message}`);
            throw new BadRequestException(`Error al eliminar abono: ${error.message}`);
        }
    }
}