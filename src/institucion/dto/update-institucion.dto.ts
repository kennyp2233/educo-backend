
// src/institucion/dto/update-institucion.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateInstitucionDto } from './create-institucion.dto';

export class UpdateInstitucionDto extends PartialType(CreateInstitucionDto) { }
