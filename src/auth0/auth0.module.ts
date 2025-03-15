// src/auth0/auth0.module.ts

import { Module, OnModuleInit } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { Auth0Service } from './auth0.service';
import { Auth0RolesService } from './auth0-roles.service';
import { Auth0UsersService } from './auth0-users.service';
import { Auth0Controller } from './auth0.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UsuariosModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';

@Module({
    imports: [
        HttpModule,
        ConfigModule,
        PrismaModule,
        UsuariosModule
    ],
    controllers: [Auth0Controller],
    providers: [
        Auth0Service,
        Auth0RolesService,
        Auth0UsersService,
        JwtStrategy,
        RolesGuard
    ],
    exports: [Auth0Service, Auth0RolesService, Auth0UsersService, RolesGuard]
})
export class Auth0Module implements OnModuleInit {
    constructor(private auth0RolesService: Auth0RolesService) { }

    /**
     * Al iniciar el módulo, sincronizar los roles de Auth0 con la BD local
     */
    async onModuleInit() {
        // Intentar sincronizar roles al iniciar
        try {
            await this.auth0RolesService.syncLocalRoles();
        } catch (error) {
            console.error('Error al sincronizar roles durante la inicialización:', error.message);
        }
    }
}