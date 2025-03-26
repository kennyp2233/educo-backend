// src/aprobaciones/dto/solicitar-aprobacion.dto.ts
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';

export enum TipoAprobacion {
    PERFIL_USUARIO = 'PERFIL_USUARIO',
    VINCULACION_PADRE_ESTUDIANTE = 'VINCULACION_PADRE_ESTUDIANTE',
    ASIGNACION_TESORERO = 'ASIGNACION_TESORERO',
    ASIGNACION_PROFESOR_CURSO = 'ASIGNACION_PROFESOR_CURSO',
    ROL_USUARIO = 'ROL_USUARIO'
}

export class SolicitarAprobacionDto {
    @IsNotEmpty()
    @IsString()
    usuarioId: string;

    @IsOptional()
    @IsString()
    entidadRelacionadaId?: string; // ID adicional para vinculaciones o asignaciones (estudiante, curso, etc.)

    @IsNotEmpty()
    @IsEnum(TipoAprobacion)
    tipoAprobacion: TipoAprobacion;

    @IsOptional()
    @IsString()
    comentarios?: string;

    @IsOptional()
    @IsString()
    datosAdicionales?: string; // Campo para almacenar datos adicionales en formato JSON
}