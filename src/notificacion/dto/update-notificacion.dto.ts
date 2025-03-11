// src/notificacion/dto/update-notificacion.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateNotificacionDto } from './create-notificacion.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificacionDto extends PartialType(CreateNotificacionDto) {
    @IsOptional()
    @IsBoolean()
    leida?: boolean;
}

