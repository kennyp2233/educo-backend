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
import { Request } from 'express';
import { UsuariosService } from '../users/users.service';

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
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al solicitar aprobación de rol');
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
            const aprobadorId = await this.getUserIdFromAuth0(req.user.sub);

            return await this.aprobacionesService.resolverAprobacionRol(
                usuarioId,
                rolId,
                aprobadorId,
                data
            );
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al resolver aprobación de rol');
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
            throw new BadRequestException(error.message || 'Error al verificar aprobación de rol');
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
            const aprobadorId = await this.getUserIdFromAuth0(req.user.sub);

            const puedeAprobar = await this.aprobacionesService.puedeAprobarRol(aprobadorId, usuarioId, rolId);
            return { puedeAprobar };
        } catch (error) {
            return { puedeAprobar: false };
        }
    }

    /**
     * Obtener solicitudes pendientes que puede aprobar el usuario actual
     */
    @Get('pendientes')
    async obtenerSolicitudesPendientes(@Req() req: RequestWithUser) {
        try {
            // Obtener el ID del usuario actual (del token JWT)
            const usuarioId = await this.getUserIdFromAuth0(req.user.sub);

            return await this.aprobacionesService.obtenerSolicitudesPendientes(usuarioId);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al obtener solicitudes pendientes');
        }
    }

    /**
     * Solicitar vinculación padre-estudiante (mantener compatibilidad con sistema anterior)
     */
    @Post('vinculacion')
    async solicitarVinculacion(
        @Body(new ValidationPipe()) data: VincularEstudianteDto
    ) {
        try {
            // Si el servicio mantiene este método, utilizarlo
            if (typeof this.aprobacionesService.solicitarVinculacion === 'function') {
                return await this.aprobacionesService.solicitarVinculacion(data);
            } else {
                throw new BadRequestException('Esta funcionalidad ha sido actualizada. Por favor, utilice el nuevo sistema de aprobación de roles.');
            }
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al solicitar vinculación');
        }
    }

    /**
     * Aprobar vinculación padre-estudiante (mantener compatibilidad con sistema anterior)
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
            const aprobadorId = await this.getUserIdFromAuth0(req.user.sub);

            // Si el servicio mantiene este método, utilizarlo
            if (typeof this.aprobacionesService.aprobarVinculacion === 'function') {
                return await this.aprobacionesService.aprobarVinculacion(
                    padreId,
                    estudianteId,
                    aprobadorId,
                    aprobado,
                    comentarios
                );
            } else {
                throw new BadRequestException('Esta funcionalidad ha sido actualizada. Por favor, utilice el nuevo sistema de aprobación de roles.');
            }
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al aprobar vinculación');
        }
    }

    /**
     * Método auxiliar para obtener el ID de usuario local a partir del ID de Auth0
     */
    private async getUserIdFromAuth0(auth0Id: string): Promise<string> {
        // Utiliza el servicio de usuarios para obtener el ID local a partir del ID de Auth0
        const usuario = await this.usuariosService.buscarPorAuth0Id(auth0Id);

        if (!usuario) {
            throw new UnauthorizedException('Usuario no encontrado');
        }

        return usuario.id;
    }
}