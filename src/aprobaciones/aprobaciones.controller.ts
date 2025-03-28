// src/aprobaciones/aprobaciones.controller.ts
import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    UseGuards,
    Req,
    ValidationPipe,
    NotFoundException,
    BadRequestException,
    Logger,
    ParseIntPipe
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AprobacionesService } from './aprobaciones.service';
import { SolicitarAprobacionDto, TipoAprobacion } from './dto/solicitar-aprobacion.dto';
import { ResolverAprobacionDto } from './dto/resolver-aprobacion.dto';
import { VincularEstudianteDto } from './dto/vincular-estudiante.dto';
import { AprobarRolDto } from './dto/aprobar-rol.dto';
import { UsuariosService } from '../users/users.service';

// Extender Request para incluir usuario de Auth0
interface RequestWithUser extends Request {
    user: {
        sub: string;
        [key: string]: any;
    }
}

@Controller('aprobaciones')
@UseGuards(AuthGuard('jwt'))
export class AprobacionesController {
    private readonly logger = new Logger(AprobacionesController.name);

    constructor(
        private readonly aprobacionesService: AprobacionesService,
        private readonly usuariosService: UsuariosService
    ) { }

    /**
     * Obtener solicitudes pendientes que puede aprobar el usuario actual
     */
    @Get('pendientes')
    async obtenerSolicitudesPendientes(@Req() req: RequestWithUser) {
        try {
            // El ID del usuario viene directamente del token JWT
            const userId = req.user.sub;
            return await this.aprobacionesService.obtenerSolicitudesPendientes(userId);
        } catch (error) {
            throw this.handleError(error, 'Error al obtener solicitudes pendientes');
        }
    }

    /**
     * Solicitar aprobación genérica
     */
    @Post('solicitar')
    async solicitarAprobacion(
        @Body(new ValidationPipe()) solicitudDto: SolicitarAprobacionDto
    ) {
        try {
            return await this.aprobacionesService.solicitarAprobacion(solicitudDto);
        } catch (error) {
            throw this.handleError(error, 'Error al solicitar aprobación');
        }
    }

    /**
     * Solicitar aprobación de rol específico
     */
    @Post('rol/:usuarioId/:rolId')
    async solicitarAprobacionRol(
        @Param('usuarioId') usuarioId: string,
        @Param('rolId', ParseIntPipe) rolId: number
    ) {
        try {
            return await this.aprobacionesService.solicitarAprobacionRol(usuarioId, rolId);
        } catch (error) {
            throw this.handleError(error, 'Error al solicitar aprobación de rol');
        }
    }

    /**
     * Resolver aprobación de rol (aprobar o rechazar)
     */
    @Post('rol/:usuarioId/:rolId/resolver')
    async resolverAprobacionRol(
        @Param('usuarioId') usuarioId: string,
        @Param('rolId', ParseIntPipe) rolId: number,
        @Body(new ValidationPipe()) resolverDto: ResolverAprobacionDto,
        @Req() req: RequestWithUser
    ) {
        try {
            // ID del aprobador viene directo del token
            const aprobadorId = req.user.sub;
            return await this.aprobacionesService.resolverAprobacionRol(
                usuarioId,
                rolId,
                aprobadorId,
                resolverDto
            );
        } catch (error) {
            throw this.handleError(error, 'Error al resolver aprobación de rol');
        }
    }

    /**
     * Solicitar vinculación padre-estudiante
     */
    @Post('vinculacion')
    async solicitarVinculacion(
        @Body(new ValidationPipe()) vincularDto: VincularEstudianteDto
    ) {
        try {
            return await this.aprobacionesService.solicitarVinculacion({
                padreId: vincularDto.padreId,
                estudianteId: vincularDto.estudianteId,
                esRepresentante: vincularDto.esRepresentante
            });
        } catch (error) {
            throw this.handleError(error, 'Error al solicitar vinculación padre-estudiante');
        }
    }

    /**
     * Resolver vinculación padre-estudiante
     */
    @Post('vinculacion/:padreId/:estudianteId/resolver')
    async resolverVinculacion(
        @Param('padreId') padreId: string,
        @Param('estudianteId') estudianteId: string,
        @Body(new ValidationPipe()) resolverDto: ResolverAprobacionDto,
        @Req() req: RequestWithUser
    ) {
        try {
            // ID del aprobador viene directo del token
            const aprobadorId = req.user.sub;
            return await this.aprobacionesService.resolverVinculacion(
                padreId,
                estudianteId,
                aprobadorId,
                resolverDto
            );
        } catch (error) {
            throw this.handleError(error, 'Error al resolver vinculación padre-estudiante');
        }
    }

    /**
     * Resolver aprobación de permiso
     */
    @Post('permiso/:permisoId/resolver')
    async resolverPermiso(
        @Param('permisoId', ParseIntPipe) permisoId: number,
        @Body(new ValidationPipe()) resolverDto: ResolverAprobacionDto,
        @Req() req: RequestWithUser
    ) {
        try {
            // ID del aprobador viene directo del token
            const aprobadorId = req.user.sub;
            return await this.aprobacionesService.resolverPermiso(
                permisoId,
                aprobadorId,
                resolverDto
            );
        } catch (error) {
            throw this.handleError(error, 'Error al resolver aprobación de permiso');
        }
    }

    /**
     * Método auxiliar para manejar errores de forma consistente
     */
    private handleError(error: any, defaultMessage: string) {
        if (error instanceof NotFoundException) {
            throw error;
        }

        this.logger.error(`${defaultMessage}: ${error.message}`, error.stack);
        throw new BadRequestException(error.message || defaultMessage);
    }
}