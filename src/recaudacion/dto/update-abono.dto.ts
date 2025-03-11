// src/recaudacion/dto/update-abono.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateAbonoDto } from './create-abono.dto';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateAbonoDto extends PartialType(CreateAbonoDto) {
    @IsOptional()
    @IsEnum(['PENDIENTE', 'APROBADO', 'RECHAZADO'])
    estado?: string;
}