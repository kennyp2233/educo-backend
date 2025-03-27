// src/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        // Obtener roles requeridos del decorador
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // Si no hay roles requeridos, permitir acceso
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        // Obtener usuario del request (establecido por JwtStrategy)
        const { user } = context.switchToHttp().getRequest();

        // Verificar que el usuario tenga al menos uno de los roles requeridos
        // y que estos roles estén aprobados
        return requiredRoles.some((role) =>
            user.approvedRoles?.includes(role.toLowerCase())
        );
    }
}