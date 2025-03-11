// src/notificacion/dto/create-notificacion-multiple.dto.ts
import { IsNotEmpty, IsString, IsEnum, IsArray } from 'class-validator';

export class CreateNotificacionMultipleDto {
    @IsNotEmpty()
    @IsArray()
    usuarioIds: string[];

    @IsNotEmpty()
    @IsString()
    titulo: string;

    @IsNotEmpty()
    @IsString()
    mensaje: string;

    @IsNotEmpty()
    @IsEnum(['INFO', 'ALERTA', 'ERROR', 'EXITO'])
    tipo: string;
}