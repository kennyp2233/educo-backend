// src/permisos/dto/create-permiso.dto.ts
import { IsNotEmpty, IsString, IsEnum, IsDateString, IsOptional } from 'class-validator';

export enum TipoPermiso {
    ACCESO_PADRE = 'ACCESO_PADRE',
    EVENTO_ESTUDIANTE = 'EVENTO_ESTUDIANTE',
    EMERGENCIA = 'EMERGENCIA',
    RECURRENTE = 'RECURRENTE'
}

export class CreatePermisoDto {
    @IsNotEmpty()
    @IsString()
    padreId: string;

    @IsNotEmpty()
    @IsString()
    cursoId: string;

    @IsOptional()
    @IsString()
    estudianteId?: string;

    @IsNotEmpty()
    @IsString()
    titulo: string;

    @IsNotEmpty()
    @IsString()
    descripcion: string;

    @IsNotEmpty()
    @IsEnum(TipoPermiso)
    tipoPermiso: TipoPermiso;

    @IsNotEmpty()
    @IsDateString()
    fechaInicio: string;

    @IsNotEmpty()
    @IsDateString()
    fechaFin: string;
}

