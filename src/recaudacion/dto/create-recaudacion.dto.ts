// src/recaudacion/dto/create-recaudacion.dto.ts
import { IsNotEmpty, IsString, IsNumber, IsDateString, Min } from 'class-validator';

export class CreateRecaudacionDto {
  @IsNotEmpty()
  @IsString()
  tesoreroId: string;

  @IsNotEmpty()
  @IsString()
  titulo: string;

  @IsNotEmpty()
  @IsString()
  descripcion: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  montoTotal: number;

  @IsNotEmpty()
  @IsDateString()
  fechaInicio: string;

  @IsNotEmpty()
  @IsDateString()
  fechaCierre: string;
}

