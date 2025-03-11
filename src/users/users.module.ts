// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsuariosService } from './users.service';
import { UsuariosController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService]
})
export class UsuariosModule {}