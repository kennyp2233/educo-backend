// src/recaudacion/dto/update-recaudacion.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateRecaudacionDto } from './create-recaudacion.dto';

export class UpdateRecaudacionDto extends PartialType(CreateRecaudacionDto) { }


