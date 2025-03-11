import { IsNotEmpty, IsString, IsObject, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePadreDto } from './create-padre.dto';
import { CreateEstudianteDto } from './create-estudiante.dto';
import { CreateProfesorDto } from './create-profesor.dto';
import { CreateTesoreroDto } from './create-tesorero.dto';

export enum PerfilTipo {
  PADRE = 'padre',
  ESTUDIANTE = 'estudiante',
  PROFESOR = 'profesor',
  TESORERO = 'tesorero'
}

export class CreateUserProfileDto {
  @IsNotEmpty()
  @IsString()
  auth0Id: string;

  @IsNotEmpty()
  @IsEnum(PerfilTipo)
  perfilTipo: PerfilTipo;

  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type((options) => {
    // Determinar qué tipo de DTO usar basado en perfilTipo
    const objeto = (options.object as CreateUserProfileDto);
    switch(objeto.perfilTipo) {
      case PerfilTipo.PADRE:
        return CreatePadreDto;
      case PerfilTipo.ESTUDIANTE:
        return CreateEstudianteDto;
      case PerfilTipo.PROFESOR:
        return CreateProfesorDto;
      case PerfilTipo.TESORERO:
        return CreateTesoreroDto;
      default:
        return Object;
    }
  })
  perfilData: CreatePadreDto | CreateEstudianteDto | CreateProfesorDto | CreateTesoreroDto;
}
