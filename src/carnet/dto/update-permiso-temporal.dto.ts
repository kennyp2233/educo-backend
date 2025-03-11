// src/carnet/dto/
import { PartialType } from '@nestjs/mapped-types';
import { CreatePermisoTemporalDto } from './create-permiso-temporal.dto';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdatePermisoTemporalDto extends PartialType(CreatePermisoTemporalDto) {
    @IsOptional()
    @IsEnum(['ACTIVO', 'INVALIDADO', 'UTILIZADO'])
    estado?: string;
}