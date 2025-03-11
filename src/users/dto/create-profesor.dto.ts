import { IsNotEmpty, IsString } from 'class-validator';

export class CreateProfesorDto {
    @IsNotEmpty()
    @IsString()
    especialidad: string;
}