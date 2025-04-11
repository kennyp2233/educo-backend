// src/recaudacion/dto/abono-directo.dto.ts
import { IsNotEmpty, IsString, IsNumber, Min, IsOptional } from 'class-validator';

export class AbonoDirectoDto {
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
    @Min(0.01, { message: 'El monto debe ser mayor a cero' })
    monto: number;

    @IsOptional()
    @IsString()
    comprobante?: string;
}