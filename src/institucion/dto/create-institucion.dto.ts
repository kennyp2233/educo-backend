// src/institucion/dto/create-institucion.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateInstitucionDto {
    @IsNotEmpty()
    @IsString()
    nombre: string;

    @IsNotEmpty()
    @IsString()
    direccion: string;

    @IsNotEmpty()
    @IsString()
    telefono: string;
}
