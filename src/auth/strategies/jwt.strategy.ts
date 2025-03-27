// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private configService: ConfigService,
        private prisma: PrismaService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET'),
        });
    }

    async validate(payload: JwtPayload) {
        // Verificar si el token es de tipo refresh
        if (payload.tokenType === 'refresh') {
            throw new UnauthorizedException('Token inválido para esta operación');
        }

        // Buscar usuario en la base de datos
        const user = await this.prisma.usuario.findUnique({
            where: { id: payload.sub },
            include: {
                roles: {
                    include: { rol: true }
                }
            }
        });

        if (!user) {
            throw new UnauthorizedException('Usuario no encontrado');
        }

        // Mapear roles para simplificar el acceso
        const roles = user.roles.map(r => r.rol.nombre);

        // Devolver información que estará disponible en req.user
        return {
            sub: user.id,
            email: user.email,
            roles,
            // Incluir información sobre roles aprobados
            approvedRoles: user.roles
                .filter(r => r.estadoAprobacion === 'APROBADO')
                .map(r => r.rol.nombre)
        };
    }
}