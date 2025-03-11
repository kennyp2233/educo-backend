// src/institucion/institucion.module.ts
import { Module } from '@nestjs/common';
import { InstitucionService } from './institucion.service';
import { InstitucionController } from './institucion.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [InstitucionController],
    providers: [InstitucionService],
    exports: [InstitucionService]
})
export class InstitucionModule { }