// src/permisos/permisos.module.ts
import { Module } from '@nestjs/common';
import { PermisosAccesoService } from './permisos.service';
import { PermisosAccesoController } from './permisos.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacionModule } from '../notificacion/notificacion.module';
import { UsuariosModule } from '../users/users.module';

@Module({
    imports: [
        PrismaModule,
        NotificacionModule,
        UsuariosModule
    ],
    controllers: [PermisosAccesoController],
    providers: [PermisosAccesoService],
    exports: [PermisosAccesoService]
})
export class PermisosAccesoModule { }