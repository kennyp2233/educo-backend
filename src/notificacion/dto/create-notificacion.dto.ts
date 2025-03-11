// src/notificacion/dto/create-notificacion.dto.ts
import { IsNotEmpty, IsString, IsEnum } from 'class-validator';

export class CreateNotificacionDto {
  @IsNotEmpty()
  @IsString()
  usuarioReceptorId: string;

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

