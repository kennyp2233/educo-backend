// src/carnet/carnet.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Carnet, PermisoTemporal } from '@prisma/client';
import { CreateCarnetDto } from './dto/create-carnet.dto';
import { UpdateCarnetDto } from './dto/update-carnet.dto';
import { CreatePermisoTemporalDto } from './dto/create-permiso-temporal.dto';
import { UpdatePermisoTemporalDto } from './dto/update-permiso-temporal.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CarnetService {
    private readonly logger = new Logger(CarnetService.name);

    constructor(private prisma: PrismaService) { }

    // ========== Métodos de Carnet ==========

    /**
     * Obtener todos los carnets
     */
    async findAllCarnets(): Promise<Carnet[]> {
        return this.prisma.carnet.findMany({
            include: {
                estudiante: {
                    include: {
                        usuario: true,
                        curso: true
                    }
                }
            }
        });
    }

    /**
     * Obtener carnets por estado
     */
    async findCarnetsByEstado(estado: string): Promise<Carnet[]> {
        return this.prisma.carnet.findMany({
            where: { estado },
            include: {
                estudiante: {
                    include: {
                        usuario: true,
                        curso: true
                    }
                }
            }
        });
    }

    /**
     * Obtener un carnet por ID
     */
    async findCarnetById(id: number): Promise<Carnet> {
        const carnet = await this.prisma.carnet.findUnique({
            where: { id },
            include: {
                estudiante: {
                    include: {
                        usuario: true,
                        curso: true
                    }
                }
            }
        });

        if (!carnet) {
            throw new NotFoundException(`Carnet con ID ${id} no encontrado`);
        }

        return carnet;
    }

    /**
     * Obtener carnet por estudiante
     */
    async findCarnetByEstudiante(estudianteId: string): Promise<Carnet> {
        const carnet = await this.prisma.carnet.findUnique({
            where: { estudianteId },
            include: {
                estudiante: {
                    include: {
                        usuario: true,
                        curso: true
                    }
                }
            }
        });

        if (!carnet) {
            throw new NotFoundException(`Carnet para estudiante con ID ${estudianteId} no encontrado`);
        }

        return carnet;
    }

    /**
     * Obtener carnet por código QR
     */
    async findCarnetByQR(codigoQR: string): Promise<Carnet> {
        const carnet = await this.prisma.carnet.findUnique({
            where: { codigoQR },
            include: {
                estudiante: {
                    include: {
                        usuario: true,
                        curso: true
                    }
                }
            }
        });

        if (!carnet) {
            throw new NotFoundException(`Carnet con código QR ${codigoQR} no encontrado`);
        }

        return carnet;
    }

    /**
     * Crear un nuevo carnet
     */
    async createCarnet(data: CreateCarnetDto): Promise<Carnet> {
        // Verificar que el estudiante existe
        const estudiante = await this.prisma.estudiante.findUnique({
            where: { usuarioId: data.estudianteId }
        });

        if (!estudiante) {
            throw new NotFoundException(`Estudiante con ID ${data.estudianteId} no encontrado`);
        }

        // Verificar que el estudiante no tiene ya un carnet activo
        const carnetExistente = await this.prisma.carnet.findUnique({
            where: { estudianteId: data.estudianteId }
        });

        if (carnetExistente) {
            throw new BadRequestException(`El estudiante ya tiene un carnet asignado con ID ${carnetExistente.id}`);
        }

        // Generar código QR único
        const codigoQR = this.generateUniqueQR();

        return this.prisma.carnet.create({
            data: {
                estudianteId: data.estudianteId,
                codigoQR,
                fechaExpiracion: new Date(data.fechaExpiracion),
                estado: 'ACTIVO'
            }
        });
    }

    /**
     * Actualizar un carnet
     */
    async updateCarnet(id: number, data: UpdateCarnetDto): Promise<Carnet> {
        // Verificar que el carnet existe
        const carnet = await this.prisma.carnet.findUnique({
            where: { id }
        });

        if (!carnet) {
            throw new NotFoundException(`Carnet con ID ${id} no encontrado`);
        }

        try {
            return await this.prisma.carnet.update({
                where: { id },
                data
            });
        } catch (error) {
            this.logger.error(`Error al actualizar carnet ${id}: ${error.message}`);
            throw new BadRequestException(`Error al actualizar carnet: ${error.message}`);
        }
    }

    /**
     * Renovar un carnet
     */
    async renovarCarnet(id: number, fechaExpiracion: Date): Promise<Carnet> {
        // Verificar que el carnet existe
        const carnet = await this.prisma.carnet.findUnique({
            where: { id }
        });

        if (!carnet) {
            throw new NotFoundException(`Carnet con ID ${id} no encontrado`);
        }

        // Verificar que la fecha de expiración es futura
        if (new Date(fechaExpiracion) <= new Date()) {
            throw new BadRequestException('La fecha de expiración debe ser futura');
        }

        return this.prisma.carnet.update({
            where: { id },
            data: {
                fechaExpiracion,
                estado: 'ACTIVO'
            }
        });
    }

    /**
     * Invalidar un carnet
     */
    async invalidarCarnet(id: number): Promise<Carnet> {
        // Verificar que el carnet existe
        const carnet = await this.prisma.carnet.findUnique({
            where: { id }
        });

        if (!carnet) {
            throw new NotFoundException(`Carnet con ID ${id} no encontrado`);
        }

        return this.prisma.carnet.update({
            where: { id },
            data: {
                estado: 'INVALIDADO'
            }
        });
    }

    /**
     * Eliminar un carnet
     */
    async deleteCarnet(id: number): Promise<Carnet> {
        try {
            return await this.prisma.carnet.delete({
                where: { id }
            });
        } catch (error) {
            this.logger.error(`Error al eliminar carnet ${id}: ${error.message}`);
            throw new BadRequestException(`Error al eliminar carnet: ${error.message}`);
        }
    }

    // ========== Métodos de Permiso Temporal ==========

    /**
     * Obtener todos los permisos temporales
     */
    async findAllPermisos(): Promise<PermisoTemporal[]> {
        return this.prisma.permisoTemporal.findMany({
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
    }

    /**
     * Obtener permisos por padre
     */
    async findPermisosByPadre(padreId: string): Promise<PermisoTemporal[]> {
        return this.prisma.permisoTemporal.findMany({
            where: { padreId },
            include: {
                estudiante: {
                    include: {
                        usuario: true,
                        curso: true
                    }
                }
            }
        });
    }

    /**
     * Obtener permisos por estudiante
     */
    async findPermisosByEstudiante(estudianteId: string): Promise<PermisoTemporal[]> {
        return this.prisma.permisoTemporal.findMany({
            where: { estudianteId },
            include: {
                padre: {
                    include: {
                        usuario: true
                    }
                }
            }
        });
    }

    /**
     * Obtener un permiso temporal por ID
     */
    async findPermisoById(id: number): Promise<PermisoTemporal> {
        const permiso = await this.prisma.permisoTemporal.findUnique({
            where: { id },
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

        if (!permiso) {
            throw new NotFoundException(`Permiso temporal con ID ${id} no encontrado`);
        }

        return permiso;
    }

    /**
     * Obtener un permiso temporal por código QR
     */
    async findPermisoByQR(codigoQR: string): Promise<PermisoTemporal> {
        const permiso = await this.prisma.permisoTemporal.findUnique({
            where: { codigoQR },
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

        if (!permiso) {
            throw new NotFoundException(`Permiso temporal con código QR ${codigoQR} no encontrado`);
        }

        return permiso;
    }

    /**
     * Crear un nuevo permiso temporal
     */
    async createPermiso(data: CreatePermisoTemporalDto): Promise<PermisoTemporal> {
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

        // Verificar que la fecha del evento es futura
        if (new Date(data.fechaEvento) <= new Date()) {
            throw new BadRequestException('La fecha del evento debe ser futura');
        }

        // Generar código QR único
        const codigoQR = this.generateUniqueQR();

        return this.prisma.permisoTemporal.create({
            data: {
                padreId: data.padreId,
                estudianteId: data.estudianteId,
                titulo: data.titulo,
                fechaEvento: new Date(data.fechaEvento),
                codigoQR,
                estado: 'ACTIVO'
            }
        });
    }

    /**
     * Actualizar un permiso temporal
     */
    async updatePermiso(id: number, data: UpdatePermisoTemporalDto): Promise<PermisoTemporal> {
        // Verificar que el permiso existe
        const permiso = await this.prisma.permisoTemporal.findUnique({
            where: { id }
        });

        if (!permiso) {
            throw new NotFoundException(`Permiso temporal con ID ${id} no encontrado`);
        }

        // Si se actualiza la fecha, verificar que es futura
        if (data.fechaEvento && new Date(data.fechaEvento) <= new Date()) {
            throw new BadRequestException('La fecha del evento debe ser futura');
        }

        try {
            return await this.prisma.permisoTemporal.update({
                where: { id },
                data
            });
        } catch (error) {
            this.logger.error(`Error al actualizar permiso ${id}: ${error.message}`);
            throw new BadRequestException(`Error al actualizar permiso: ${error.message}`);
        }
    }

    /**
     * Invalidar un permiso temporal
     */
    async invalidarPermiso(id: number): Promise<PermisoTemporal> {
        // Verificar que el permiso existe
        const permiso = await this.prisma.permisoTemporal.findUnique({
            where: { id }
        });

        if (!permiso) {
            throw new NotFoundException(`Permiso temporal con ID ${id} no encontrado`);
        }

        return this.prisma.permisoTemporal.update({
            where: { id },
            data: {
                estado: 'INVALIDADO'
            }
        });
    }

    /**
     * Eliminar un permiso temporal
     */
    async deletePermiso(id: number): Promise<PermisoTemporal> {
        try {
            return await this.prisma.permisoTemporal.delete({
                where: { id }
            });
        } catch (error) {
            this.logger.error(`Error al eliminar permiso ${id}: ${error.message}`);
            throw new BadRequestException(`Error al eliminar permiso: ${error.message}`);
        }
    }

    // ========== Métodos auxiliares ==========

    /**
     * Generar un código QR único aleatorio
     */
    private generateUniqueQR(): string {
        return uuidv4();
    }
}