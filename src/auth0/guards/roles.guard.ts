// src/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsuariosService } from '../../users/users.service';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private usuariosService: UsuariosService
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
        if (!requiredRoles) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();
        if (!user || !user.sub) {
            return false;
        }

        // Buscar usuario en base de datos local por auth0Id
        const usuario = await this.usuariosService.buscarPorAuth0Id(user.sub);
        if (!usuario) {
            return false;
        }

        // Obtener roles del usuario
        const rolesUsuario = await this.usuariosService.obtenerRolesUsuario(usuario.id);

        // Verificar si el usuario tiene alguno de los roles requeridos
        return requiredRoles.some(role =>
            rolesUsuario.some(r => r.toLowerCase() === role.toLowerCase())
        );
    }
}