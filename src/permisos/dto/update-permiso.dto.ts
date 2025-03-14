// src/permisos/dto/update-permiso.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreatePermisoDto } from './create-permiso.dto';

export enum EstadoPermiso {
    PENDIENTE = 'PENDIENTE',
    APROBADO = 'APROBADO',
    RECHAZADO = 'RECHAZADO',
    UTILIZADO = 'UTILIZADO',
    VENCIDO = 'VENCIDO'
}

export class UpdatePermisoDto extends PartialType(CreatePermisoDto) {
    @IsOptional()
    @IsEnum(EstadoPermiso)
    estado?: EstadoPermiso;
}