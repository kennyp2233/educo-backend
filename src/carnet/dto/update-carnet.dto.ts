// src/carnet/dto/update-carnet.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateCarnetDto } from './create-carnet.dto';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateCarnetDto extends PartialType(CreateCarnetDto) {
  @IsOptional()
  @IsEnum(['ACTIVO', 'INVALIDADO', 'EXPIRADO'])
  estado?: string;
}

