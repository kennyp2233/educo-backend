// src/aprobaciones/dto/resolver-aprobacion.dto.ts
import { IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';

export class ResolverAprobacionDto {
    @IsNotEmpty()
    @IsBoolean()
    aprobado: boolean;

    @IsOptional()
    @IsString()
    comentarios?: string;
}