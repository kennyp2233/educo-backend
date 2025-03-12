// src/permisos/dto/create-permiso-acceso.dto.ts
import { IsNotEmpty, IsString, IsEnum, IsDateString, IsOptional } from 'class-validator';

export enum TipoPermiso {
    REGULAR = 'REGULAR',
    ESPECIFICO = 'ESPECIFICO',
    EMERGENCIA = 'EMERGENCIA',
    RECURRENTE = 'RECURRENTE'
}

export class CreatePermisoAccesoDto {
    @IsNotEmpty()
    @IsString()
    padreId: string;

    @IsNotEmpty()
    @IsString()
    cursoId: string;

    @IsNotEmpty()
    @IsEnum(TipoPermiso)
    tipoPermiso: TipoPermiso;

    @IsNotEmpty()
    @IsString()
    motivo: string;

    @IsNotEmpty()
    @IsDateString()
    fechaInicio: string;

    @IsNotEmpty()
    @IsDateString()
    fechaFin: string;
}