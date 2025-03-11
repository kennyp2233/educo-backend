import { IsNotEmpty, IsNumber } from 'class-validator';

export class CreateTesoreroDto {
  @IsNotEmpty()
  @IsNumber()
  cursoId: number;
}