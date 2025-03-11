import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePadreDto {
    @IsNotEmpty()
    @IsString()
    direccion: string;

    @IsNotEmpty()
    @IsString()
    telefono: string;
}

