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
    UnauthorizedException,
    ParseIntPipe,
    Logger
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AprobacionesService } from './aprobaciones.service';
import { ResolverAprobacionDto } from './dto/resolver-aprobacion.dto';
import { VincularEstudianteDto } from './dto/vincular-estudiante.dto';
import { SolicitarAprobacionDto, TipoAprobacion } from './dto/solicitar-aprobacion.dto';
import { Request } from 'express';
import { Auth0Service } from '../auth0/auth0.service';

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
        private readonly auth0Service: Auth0Service
    ) { }

    /**
     * Obtener solicitudes pendientes que puede aprobar el usuario actual
     */
    @Get('pendientes')
    async obtenerSolicitudesPendientes(@Req() req: RequestWithUser) {
        try {
            // Obtener el ID del usuario actual (del token JWT)
            const usuarioId = await this.auth0Service.getUserIdFromAuth0(req.user.sub);
            return await this.aprobacionesService.obtenerSolicitudesPendientes(usuarioId);
        } catch (error) {
            return this.handleError(error, 'Error al obtener solicitudes pendientes');
        }
    }

    /**
     * Solicitar aprobación
     */
    @Post('solicitar')
    async solicitarAprobacion(
        @Body(new ValidationPipe()) solicitudDto: SolicitarAprobacionDto
    ) {
        try {
            return await this.aprobacionesService.solicitarAprobacion(solicitudDto);
        } catch (error) {
            return this.handleError(error, 'Error al solicitar aprobación');
        }
    }

    /**
     * Solicitar aprobación de un rol específico
     */
    @Post('rol/:usuarioId/:rolId')
    async solicitarAprobacionRol(
        @Param('usuarioId') usuarioId: string,
        @Param('rolId', ParseIntPipe) rolId: number
    ) {
        try {
            return await this.aprobacionesService.solicitarAprobacionRol(usuarioId, rolId);
        } catch (error) {
            return this.handleError(error, 'Error al solicitar aprobación de rol');
        }
    }

    /**
     * Resolver aprobación de rol (aprobar o rechazar)
     */
    @Post('rol/:usuarioId/:rolId/resolver')
    async resolverAprobacionRol(
        @Param('usuarioId') usuarioId: string,
        @Param('rolId', ParseIntPipe) rolId: number,
        @Body(new ValidationPipe()) data: ResolverAprobacionDto,
        @Req() req: RequestWithUser
    ) {
        try {
            // Obtener el ID del usuario que está haciendo la aprobación (del token JWT)
            const aprobadorId = await this.auth0Service.getUserIdFromAuth0(req.user.sub);

            return await this.aprobacionesService.resolverAprobacionRol(
                usuarioId,
                rolId,
                aprobadorId,
                data
            );
        } catch (error) {
            return this.handleError(error, 'Error al resolver aprobación de rol');
        }
    }

    /**
     * Verificar si un usuario tiene un rol específico aprobado
     */
    @Get('verificar/:usuarioId/:rolNombre')
    async verificarRolAprobado(
        @Param('usuarioId') usuarioId: string,
        @Param('rolNombre') rolNombre: string
    ) {
        try {
            const aprobado = await this.aprobacionesService.verificarRolAprobado(usuarioId, rolNombre);
            return { aprobado };
        } catch (error) {
            return this.handleError(error, 'Error al verificar aprobación de rol');
        }
    }

    /**
     * Verificar si el usuario actual puede aprobar a otro para un rol específico
     */
    @Get('puede-aprobar/:usuarioId/:rolId')
    async verificarPuedeAprobarRol(
        @Param('usuarioId') usuarioId: string,
        @Param('rolId', ParseIntPipe) rolId: number,
        @Req() req: RequestWithUser
    ) {
        try {
            // Obtener el ID del usuario actual (del token JWT)
            const aprobadorId = await this.auth0Service.getUserIdFromAuth0(req.user.sub);

            const puedeAprobar = await this.aprobacionesService.puedeAprobarRol(aprobadorId, usuarioId, rolId);
            return { puedeAprobar };
        } catch (error) {
            return { puedeAprobar: false };
        }
    }

    /**
     * Solicitar vinculación padre-estudiante (compatibilidad con sistema anterior)
     */
    @Post('vinculacion')
    async solicitarVinculacion(
        @Body(new ValidationPipe()) data: VincularEstudianteDto
    ) {
        try {
            return await this.aprobacionesService.solicitarVinculacion({
                padreId: data.padreId,
                estudianteId: data.estudianteId,
                esRepresentante: data.esRepresentante
            });
        } catch (error) {
            return this.handleError(error, 'Error al solicitar vinculación');
        }
    }

    /**
     * Aprobar vinculación padre-estudiante (compatibilidad con sistema anterior)
     */
    @Post('vinculacion/:padreId/:estudianteId/aprobar')
    async aprobarVinculacion(
        @Param('padreId') padreId: string,
        @Param('estudianteId') estudianteId: string,
        @Body('aprobado') aprobado: boolean,
        @Body('comentarios') comentarios: string,
        @Req() req: RequestWithUser
    ) {
        try {
            // Obtener el ID del usuario que está haciendo la aprobación (del token JWT)
            const aprobadorId = await this.auth0Service.getUserIdFromAuth0(req.user.sub);

            // Crear un DTO para resolver la aprobación
            const resolverDto: ResolverAprobacionDto = {
                aprobado,
                comentarios
            };

            // Obtener el ID de la solicitud de vinculación
            const solicitudId = await this.aprobacionesService.obtenerSolicitudVinculacion(padreId, estudianteId);

            if (!solicitudId) {
                throw new NotFoundException('No se encontró solicitud de vinculación para estos usuarios');
            }

            return await this.aprobacionesService.resolverAprobacion(solicitudId, aprobadorId, resolverDto);
        } catch (error) {
            return this.handleError(error, 'Error al aprobar vinculación');
        }
    }

    /**
     * Manejo de errores estandarizado
     */
    private handleError(error: any, defaultMessage: string) {
        if (error instanceof NotFoundException) {
            throw error;
        }
        if (error instanceof UnauthorizedException) {
            throw error;
        }
        this.logger.error(`${defaultMessage}: ${error.message}`);
        throw new BadRequestException(error.message || defaultMessage);
    }
}