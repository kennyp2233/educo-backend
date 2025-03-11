import { IsNotEmpty, IsString, IsBoolean } from 'class-validator';

export class AsignarEstudianteDto {
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
