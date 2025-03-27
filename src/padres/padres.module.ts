// src/padres/padres.module.ts
import { Module } from '@nestjs/common';
import { PadresController } from './padres.controller';
import { PadresService } from './padres.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [PadresController],
    providers: [PadresService],
    exports: [PadresService]
})
export class PadresModule { }