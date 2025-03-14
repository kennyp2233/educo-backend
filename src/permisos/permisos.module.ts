// src/permisos/permisos.module.ts
import { Module } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { PermisosController } from './permisos.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacionModule } from '../notificacion/notificacion.module';
import { UsuariosModule } from '../users/users.module';

@Module({
    imports: [
        PrismaModule,
        NotificacionModule,
        UsuariosModule
    ],
    controllers: [PermisosController],
    providers: [PermisosService],
    exports: [PermisosService]
})
export class PermisosModule { }