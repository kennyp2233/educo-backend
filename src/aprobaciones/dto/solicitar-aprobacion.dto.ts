// src/aprobaciones/dto/solicitar-aprobacion.dto.ts
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';

export enum TipoAprobacion {
    PERFIL_USUARIO = 'PERFIL_USUARIO',
    VINCULACION_PADRE_ESTUDIANTE = 'VINCULACION_PADRE_ESTUDIANTE',
    ASIGNACION_TESORERO = 'ASIGNACION_TESORERO',
    ASIGNACION_PROFESOR_CURSO = 'ASIGNACION_PROFESOR_CURSO'
}

export class SolicitarAprobacionDto {
    @IsNotEmpty()
    @IsString()
    usuarioId: string;

    @IsOptional()
    @IsString()
    entidadRelacionadaId?: string; // ID adicional para vinculaciones o asignaciones

    @IsNotEmpty()
    @IsEnum(TipoAprobacion)
    tipoAprobacion: TipoAprobacion;

    @IsOptional()
    @IsString()
    comentarios?: string;
}