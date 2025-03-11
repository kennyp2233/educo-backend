// src/notificacion/notificacion.module.ts
import { Module } from '@nestjs/common';
import { NotificacionService } from './notificacion.service';
import { NotificacionController } from './notificacion.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [NotificacionController],
    providers: [NotificacionService],
    exports: [NotificacionService]
})
export class NotificacionModule { }