// src/auth0/dto/register.dto.ts
import { IsEmail, IsNotEmpty, MinLength, IsString, IsObject, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsString()
  role: string;

  @IsOptional()
  @IsObject()
  perfilData?: any;
}