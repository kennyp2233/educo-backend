// src/aprobaciones/guards/aprobacion.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AprobacionesService } from '../aprobaciones.service';
import { UsuariosService } from '../../users/users.service';

export const ROLES_APROBADOS_KEY = 'roles_aprobados';
export const RolesAprobados = (...roles: string[]) => SetMetadata(ROLES_APROBADOS_KEY, roles);

@Injectable()
export class AprobacionGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private aprobacionesService: AprobacionesService,
        private usuariosService: UsuariosService
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Obtener roles requeridos del decorador
        const requiredRoles = this.reflector.get<string[]>(
            ROLES_APROBADOS_KEY,
            context.getHandler(),
        );

        // Si no hay roles requeridos, permitir acceso
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        // Obtener usuario del request
        const { user } = context.switchToHttp().getRequest();
        if (!user || !user.sub) {
            throw new UnauthorizedException('Usuario no autenticado');
        }

        // Obtener usuario local
        const usuario = await this.usuariosService.buscarPorAuth0Id(user.sub);
        if (!usuario) {
            throw new UnauthorizedException('Usuario no encontrado en el sistema');
        }

        // Verificar que el usuario tenga al menos uno de los roles requeridos aprobados
        for (const rol of requiredRoles) {
            const aprobado = await this.usuariosService.verificarRolAprobado(usuario.id, rol);
            if (aprobado) {
                return true;
            }
        }

        throw new UnauthorizedException('No tiene los roles requeridos aprobados para acceder a este recurso');
    }
}