
// src/institucion/dto/create-curso.dto.ts
import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateCursoDto {
    @IsNotEmpty()
    @IsNumber()
    institucionId: number;

    @IsNotEmpty()
    @IsString()
    nombre: string;

    @IsNotEmpty()
    @IsString()
    paralelo: string;

    @IsNotEmpty()
    @IsString()
    anioLectivo: string;
}

