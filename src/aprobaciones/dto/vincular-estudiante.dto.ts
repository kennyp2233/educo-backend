// src/aprobaciones/dto/vincular-estudiante.dto.ts
import { IsNotEmpty, IsString, IsBoolean } from 'class-validator';

export class VincularEstudianteDto {
    @IsNotEmpty()
    @IsString()
    padreId: string;

    @IsNotEmpty()
    @IsString()
    estudianteId: string;

    @IsNotEmpty()
    @IsBoolean()
    esRepresentante: boolean;
}
