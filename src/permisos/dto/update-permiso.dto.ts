// src/permisos/dto/update-permiso.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreatePermisoDto } from './create-permiso.dto';
import { $Enums } from '@prisma/client';


export class UpdatePermisoDto extends PartialType(CreatePermisoDto) {
    @IsOptional()
    @IsEnum($Enums.EstadoPermiso)
    estado?: $Enums.EstadoPermiso;
}