// src/aprobaciones/aprobaciones.module.ts
import { Module } from '@nestjs/common';
import { AprobacionesService } from './aprobaciones.service';
import { AprobacionesController } from './aprobaciones.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacionModule } from '../notificacion/notificacion.module';
import { UsuariosModule } from '../users/users.module';

@Module({
    imports: [
        PrismaModule,
        NotificacionModule,
        UsuariosModule
    ],
    controllers: [AprobacionesController],
    providers: [AprobacionesService],
    exports: [AprobacionesService]
})
export class AprobacionesModule { }