import { IsNotEmpty, IsString, IsBoolean, IsNumber } from 'class-validator';

export class AsignarProfesorDto {
  @IsNotEmpty()
  @IsString()
  profesorId: string;

  @IsNotEmpty()
  @IsNumber()
  cursoId: number;

  @IsNotEmpty()
  @IsBoolean()
  esTutor: boolean;
}