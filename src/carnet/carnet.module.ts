// src/carnet/carnet.module.ts
import { Module } from '@nestjs/common';
import { CarnetService } from './carnet.service';
import { CarnetController } from './carnet.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [CarnetController],
    providers: [CarnetService],
    exports: [CarnetService]
})
export class CarnetModule { }