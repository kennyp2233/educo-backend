import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateEstudianteDto {
    @IsNotEmpty()
    @IsNumber()
    cursoId: number;

    @IsNotEmpty()
    @IsString()
    grado: string;
}