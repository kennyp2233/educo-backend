// src/users/users.module.ts

import { Module } from '@nestjs/common';
import { UsuariosService } from './users.service';
import { UsuariosController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UserInstitutionService } from './user-institution.service';
import { UserInstitutionController } from './user-institution.controller';

@Module({
  imports: [PrismaModule],
  controllers: [UsuariosController, UserInstitutionController],
  providers: [UsuariosService, UserInstitutionService],
  exports: [UsuariosService, UserInstitutionService]
})
export class UsuariosModule { }