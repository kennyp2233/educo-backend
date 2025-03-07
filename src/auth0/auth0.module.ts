// src/auth0/auth0.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { Auth0Service } from './auth0.service';
import { Auth0Controller } from './auth0.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UsuariosModule } from '../users/users.module';

@Module({
    imports: [
        HttpModule,
        ConfigModule,
        PrismaModule,
        UsuariosModule
    ],
    controllers: [Auth0Controller],
    providers: [Auth0Service],
    exports: [Auth0Service]
})
export class Auth0Module { }