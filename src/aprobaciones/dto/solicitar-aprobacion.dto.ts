// src/aprobaciones/dto/solicitar-aprobacion.dto.ts
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsBoolean, IsNumber } from 'class-validator';

export enum TipoAprobacion {
    ROL_USUARIO = 'ROL_USUARIO',
    VINCULACION_PADRE_ESTUDIANTE = 'VINCULACION_PADRE_ESTUDIANTE',
    PERMISO = 'PERMISO'
}

export class SolicitarAprobacionDto {
    @IsNotEmpty()
    @IsEnum(TipoAprobacion)
    tipoAprobacion: TipoAprobacion;

    // Campos para ROL_USUARIO
    @IsOptional()
    @IsString()
    usuarioId?: string;

    @IsOptional()
    @IsNumber()
    rolId?: number;

    // Campos para VINCULACION_PADRE_ESTUDIANTE
    @IsOptional()
    @IsString()
    padreId?: string;

    @IsOptional()
    @IsString()
    estudianteId?: string;

    @IsOptional()
    @IsBoolean()
    esRepresentante?: boolean;

    // Campos para PERMISO
    @IsOptional()
    @IsNumber()
    permisoId?: number;

    @IsOptional()
    @IsString()
    comentarios?: string;
}