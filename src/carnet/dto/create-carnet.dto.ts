// src/carnet/dto/create-carnet.dto.ts
import { IsNotEmpty, IsString, IsDateString } from 'class-validator';

export class CreateCarnetDto {
  @IsNotEmpty()
  @IsString()
  estudianteId: string;

  @IsNotEmpty()
  @IsDateString()
  fechaExpiracion: string;
}

