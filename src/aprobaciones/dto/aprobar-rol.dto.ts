// src/aprobaciones/dto/aprobar-rol.dto.ts
import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class AprobarRolDto {
    @IsNotEmpty()
    @IsString()
    usuarioId: string;

    @IsNotEmpty()
    @IsNumber()
    rolId: number;
}