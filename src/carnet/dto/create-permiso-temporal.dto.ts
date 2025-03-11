// src/carnet/dto/create-permiso-temporal.dto.ts
import { IsNotEmpty, IsString, IsDateString } from 'class-validator';

export class CreatePermisoTemporalDto {
  @IsNotEmpty()
  @IsString()
  padreId: string;

  @IsNotEmpty()
  @IsString()
  estudianteId: string;

  @IsNotEmpty()
  @IsString()
  titulo: string;

  @IsNotEmpty()
  @IsDateString()
  fechaEvento: string;
}

