
// src/recaudacion/recaudacion.module.ts
import { Module } from '@nestjs/common';
import { RecaudacionService } from './recaudacion.service';
import { RecaudacionController } from './recaudacion.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [RecaudacionController],
    providers: [RecaudacionService],
    exports: [RecaudacionService]
})
export class RecaudacionModule { }