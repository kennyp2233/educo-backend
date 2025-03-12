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
    UnauthorizedException
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AprobacionesService } from './aprobaciones.service';
import { SolicitarAprobacionDto } from './dto/solicitar-aprobacion.dto';
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
    constructor(
        private readonly aprobacionesService: AprobacionesService,
        private readonly usuariosService: UsuariosService
    ) { }

    /**
     * Solicitar aprobación de perfil
     */
    @Post('perfil/:id')
    async solicitarAprobacionPerfil(
        @Param('id') id: string
    ) {
        try {
            return await this.aprobacionesService.solicitarAprobacionPerfil(id);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al solicitar aprobación');
        }
    }

    /**
     * Resolver aprobación (aprobar o rechazar)
     */
    @Post('perfil/:id/resolver')
    async resolverAprobacion(
        @Param('id') id: string,
        @Body(new ValidationPipe()) data: ResolverAprobacionDto,
        @Req() req: RequestWithUser
    ) {
        try {
            // Obtener el ID del usuario que está haciendo la aprobación (del token JWT)
            const aprobadorId = await this.getUserIdFromAuth0(req.user.sub);

            return await this.aprobacionesService.resolverAprobacion(id, aprobadorId, data);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al resolver aprobación');
        }
    }

    /**
     * Solicitar vinculación padre-estudiante
     */
    @Post('vinculacion')
    async solicitarVinculacion(
        @Body(new ValidationPipe()) data: VincularEstudianteDto
    ) {
        try {
            return await this.aprobacionesService.solicitarVinculacion(data);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al solicitar vinculación');
        }
    }

    /**
     * Aprobar vinculación padre-estudiante
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

            return await this.aprobacionesService.aprobarVinculacion(
                padreId,
                estudianteId,
                aprobadorId,
                aprobado,
                comentarios
            );
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al aprobar vinculación');
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
     * Verificar si el usuario actual puede aprobar a otro
     */
    @Get('puede-aprobar/:id')
    async verificarPuedeAprobar(
        @Param('id') id: string,
        @Req() req: RequestWithUser
    ) {
        try {
            // Obtener el ID del usuario actual (del token JWT)
            const usuarioId = await this.getUserIdFromAuth0(req.user.sub);

            const puedeAprobar = await this.aprobacionesService.puedeAprobar(usuarioId, id);
            return { puedeAprobar };
        } catch (error) {
            return { puedeAprobar: false };
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