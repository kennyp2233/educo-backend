// src/padres/padres.controller.ts
import {
    Controller,
    Get,
    Param,
    UseGuards,
    Query,
    BadRequestException,
    Logger,
    NotFoundException
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PadresService } from './padres.service';
import { Roles } from 'src/auth0/decorators/roles.decorator';
import { RolesGuard } from 'src/auth0/guards/roles.guard';

@Controller('padres')
@UseGuards(AuthGuard('jwt'))
export class PadresController {
    private readonly logger = new Logger(PadresController.name);

    constructor(private readonly padresService: PadresService) { }

    /**
     * Obtiene todos los hijos vinculados a un padre
     */
    @Get(':padreId/hijos')
    async obtenerHijos(@Param('padreId') padreId: string) {
        try {
            return await this.padresService.obtenerHijos(padreId);
        } catch (error) {
            this.logger.error(`Error al obtener hijos del padre ${padreId}: ${error.message}`);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(`Error al obtener hijos del padre: ${error.message}`);
        }
    }

    /**
     * Obtiene todos los cursos disponibles, opcionalmente filtrados
     */
    @Get('cursos/disponibles')
    async obtenerCursosDisponibles(
        @Query('institucionId') institucionId?: string,
        @Query('anioLectivo') anioLectivo?: string,
        @Query('grado') grado?: string
    ) {
        try {
            return await this.padresService.obtenerCursosDisponibles(institucionId, anioLectivo, grado);
        } catch (error) {
            this.logger.error(`Error al obtener cursos disponibles: ${error.message}`);
            throw new BadRequestException(`Error al obtener cursos disponibles: ${error.message}`);
        }
    }

    /**
     * Obtiene información detallada de un curso específico
     */
    @Get('cursos/:cursoId/detalle')
    async obtenerDetalleCurso(@Param('cursoId') cursoId: string) {
        try {
            return await this.padresService.obtenerDetalleCurso(cursoId);
        } catch (error) {
            this.logger.error(`Error al obtener detalle del curso ${cursoId}: ${error.message}`);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(`Error al obtener detalle del curso: ${error.message}`);
        }
    }

    /**
     * Obtiene un dashboard resumido para un padre
     */
    @Get(':padreId/dashboard')
    async obtenerDashboard(@Param('padreId') padreId: string) {
        try {
            return await this.padresService.obtenerDashboard(padreId);
        } catch (error) {
            this.logger.error(`Error al obtener dashboard del padre ${padreId}: ${error.message}`);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(`Error al obtener dashboard: ${error.message}`);
        }
    }

    /**
     * Verifica si un estudiante está vinculado a un padre
     */
    @Get(':padreId/verificar-hijo/:estudianteId')
    async verificarVinculacion(
        @Param('padreId') padreId: string,
        @Param('estudianteId') estudianteId: string
    ) {
        try {
            // Verificar que el padre existe
            const padre = await this.padresService.obtenerHijos(padreId);

            // Verificar si el estudiante está en la lista de hijos
            const hijoVinculado = padre.find(h => h.estudiante.id === estudianteId);

            return {
                vinculado: !!hijoVinculado,
                esRepresentante: hijoVinculado ? hijoVinculado.vinculacion.esRepresentante : false,
                estadoVinculacion: hijoVinculado ? hijoVinculado.vinculacion.estadoVinculacion : null
            };
        } catch (error) {
            this.logger.error(`Error al verificar vinculación: ${error.message}`);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(`Error al verificar vinculación: ${error.message}`);
        }
    }

    @Get('vinculaciones/pendientes')
    @UseGuards(AuthGuard('jwt'), RolesGuard) // Solo admins y profesores pueden ver todas las vinculaciones
    @Roles('admin', 'profesor') // Solo admins y profesores pueden ver todas las vinculaciones
    async obtenerVinculacionesPendientes() {
        try {
            return await this.padresService.obtenerVinculacionesPendientes();
        } catch (error) {
            this.logger.error(`Error al obtener vinculaciones pendientes: ${error.message}`);
            throw new BadRequestException(`Error al obtener vinculaciones pendientes: ${error.message}`);
        }
    }

    /**
   * Obtiene las vinculaciones pendientes para un padre específico
   */
    @Get(':padreId/vinculaciones/pendientes')
    @UseGuards(AuthGuard('jwt'))
    async obtenerVinculacionesPendientesPorPadre(@Param('padreId') padreId: string) {
        try {
            return await this.padresService.obtenerVinculacionesPendientes(padreId);
        } catch (error) {
            this.logger.error(`Error al obtener vinculaciones pendientes para padre ${padreId}: ${error.message}`);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(`Error al obtener vinculaciones pendientes: ${error.message}`);
        }
    }
}