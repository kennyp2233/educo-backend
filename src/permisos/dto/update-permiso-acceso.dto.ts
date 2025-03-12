// src/permisos/dto/update-permiso-acceso.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreatePermisoAccesoDto } from './create-permiso-acceso.dto';

export enum EstadoPermiso {
    PENDIENTE = 'PENDIENTE',
    APROBADO = 'APROBADO',
    RECHAZADO = 'RECHAZADO',
    UTILIZADO = 'UTILIZADO',
    VENCIDO = 'VENCIDO'
}

export class UpdatePermisoAccesoDto extends PartialType(CreatePermisoAccesoDto) {
    @IsOptional()
    @IsEnum(EstadoPermiso)
    estadoPermiso?: EstadoPermiso;
}