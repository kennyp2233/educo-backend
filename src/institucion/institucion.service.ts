// src/institucion/institucion.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Institucion, Curso } from '@prisma/client';
import { CreateInstitucionDto } from './dto/create-institucion.dto';
import { UpdateInstitucionDto } from './dto/update-institucion.dto';
import { CreateCursoDto } from './dto/create-curso.dto';
import { UpdateCursoDto } from './dto/update-curso.dto';

@Injectable()
export class InstitucionService {
    private readonly logger = new Logger(InstitucionService.name);

    constructor(private prisma: PrismaService) { }

    // ========== Métodos de Institución ==========

    /**
     * Obtener todas las instituciones
     */
    async findAllInstituciones(): Promise<Institucion[]> {
        return this.prisma.institucion.findMany({
            include: {
                cursos: true
            }
        });
    }

    /**
     * Obtener una institución por ID
     */
    async findInstitucionById(id: number): Promise<Institucion> {
        const institucion = await this.prisma.institucion.findUnique({
            where: { id },
            include: {
                cursos: true
            }
        });

        if (!institucion) {
            throw new NotFoundException(`Institución con ID ${id} no encontrada`);
        }

        return institucion;
    }

    /**
     * Crear una nueva institución
     */
    async createInstitucion(data: CreateInstitucionDto): Promise<Institucion> {
        return this.prisma.institucion.create({
            data
        });
    }

    /**
     * Actualizar una institución
     */
    async updateInstitucion(id: number, data: UpdateInstitucionDto): Promise<Institucion> {
        try {
            return await this.prisma.institucion.update({
                where: { id },
                data
            });
        } catch (error) {
            this.logger.error(`Error al actualizar institución ${id}: ${error.message}`);
            throw new NotFoundException(`Institución con ID ${id} no encontrada`);
        }
    }

    /**
     * Eliminar una institución
     */
    async deleteInstitucion(id: number): Promise<Institucion> {
        try {
            return await this.prisma.institucion.delete({
                where: { id }
            });
        } catch (error) {
            this.logger.error(`Error al eliminar institución ${id}: ${error.message}`);
            throw new NotFoundException(`Institución con ID ${id} no encontrada`);
        }
    }

    // ========== Métodos de Curso ==========

    /**
     * Obtener todos los cursos
     */
    async findAllCursos(): Promise<Curso[]> {
        return this.prisma.curso.findMany({
            include: {
                institucion: true,
                estudiantes: true,
                profesorCurso: {
                    include: {
                        profesor: true
                    }
                }
            }
        });
    }

    /**
     * Obtener cursos por institución
     */
    async findCursosByInstitucion(institucionId: number): Promise<Curso[]> {
        return this.prisma.curso.findMany({
            where: { institucionId },
            include: {
                estudiantes: true,
                profesorCurso: {
                    include: {
                        profesor: true
                    }
                }
            }
        });
    }

    /**
     * Obtener un curso por ID
     */
    async findCursoById(id: number): Promise<Curso> {
        const curso = await this.prisma.curso.findUnique({
            where: { id },
            include: {
                institucion: true,
                estudiantes: true,
                profesorCurso: {
                    include: {
                        profesor: true
                    }
                }
            }
        });

        if (!curso) {
            throw new NotFoundException(`Curso con ID ${id} no encontrado`);
        }

        return curso;
    }

    /**
     * Crear un nuevo curso
     */
    async createCurso(data: CreateCursoDto): Promise<Curso> {
        // Verificar que la institución existe
        const institucion = await this.prisma.institucion.findUnique({
            where: { id: data.institucionId }
        });

        if (!institucion) {
            throw new NotFoundException(`Institución con ID ${data.institucionId} no encontrada`);
        }

        return this.prisma.curso.create({
            data
        });
    }

    /**
     * Actualizar un curso
     */
    async updateCurso(id: number, data: UpdateCursoDto): Promise<Curso> {
        try {
            return await this.prisma.curso.update({
                where: { id },
                data
            });
        } catch (error) {
            this.logger.error(`Error al actualizar curso ${id}: ${error.message}`);
            throw new NotFoundException(`Curso con ID ${id} no encontrado`);
        }
    }

    /**
     * Eliminar un curso
     */
    async deleteCurso(id: number): Promise<Curso> {
        try {
            return await this.prisma.curso.delete({
                where: { id }
            });
        } catch (error) {
            this.logger.error(`Error al eliminar curso ${id}: ${error.message}`);
            throw new NotFoundException(`Curso con ID ${id} no encontrado`);
        }
    }
}