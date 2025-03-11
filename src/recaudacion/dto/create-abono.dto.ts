// src/recaudacion/dto/create-abono.dto.ts
import { IsNotEmpty, IsString, IsNumber, IsDateString, Min, IsOptional } from 'class-validator';

export class CreateAbonoDto {
    @IsNotEmpty()
    @IsNumber()
    recaudacionId: number;

    @IsNotEmpty()
    @IsString()
    padreId: string;

    @IsNotEmpty()
    @IsString()
    estudianteId: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    monto: number;

    @IsOptional()
    @IsDateString()
    fechaPago?: string;

    @IsOptional()
    @IsString()
    comprobante?: string;
}
