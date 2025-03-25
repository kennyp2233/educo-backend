// src/aprobaciones/guards/approval.guard.ts

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AprobacionesService } from '../aprobaciones.service';
import { UsuariosService } from '../../users/users.service';

@Injectable()
export class ApprovalGuard implements CanActivate {
    constructor(
        private aprobacionesService: AprobacionesService,
        private usuariosService: UsuariosService
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user || !user.sub) {
            throw new UnauthorizedException('Usuario no autenticado');
        }

        // Obtener el usuario local por su auth0Id
        const usuario = await this.usuariosService.buscarPorAuth0Id(user.sub);
        if (!usuario) {
            throw new UnauthorizedException('Usuario no encontrado en el sistema');
        }

        // Verificar si el usuario está aprobado
        const isApproved = await this.aprobacionesService.verificarAprobacion(usuario.id);

        if (!isApproved) {
            throw new UnauthorizedException('Su cuenta está pendiente de aprobación');
        }

        return true;
    }
}