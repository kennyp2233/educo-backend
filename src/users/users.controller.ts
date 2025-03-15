// src/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ValidationPipe
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsuariosService } from './users.service';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { CreatePadreDto } from './dto/create-padre.dto';
import { CreateEstudianteDto } from './dto/create-estudiante.dto';
import { CreateProfesorDto } from './dto/create-profesor.dto';
import { CreateTesoreroDto } from './dto/create-tesorero.dto';
import { AsignarEstudianteDto } from './dto/asignar-estudiante.dto';
import { AsignarProfesorDto } from './dto/asignar-profesor.dto';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) { }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async findAll() {
    // Este método debería tener restricciones adicionales en producción
    return { message: 'Este endpoint debe tener restricciones en producción' };
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async findOne(@Param('id') id: string) {
    const usuario = await this.usuariosService.buscarPorId(id);
    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    return usuario;
  }

  @Get('auth0/:auth0Id')
  @UseGuards(AuthGuard('jwt'))
  async findByAuth0Id(@Param('auth0Id') auth0Id: string) {
    const usuario = await this.usuariosService.buscarPorAuth0Id(auth0Id);
    if (!usuario) {
      throw new NotFoundException(`Usuario con Auth0 ID ${auth0Id} no encontrado`);
    }
    return usuario;
  }

  @Post('perfil-completo')
  @UseGuards(AuthGuard('jwt'))
  async createUserWithProfile(@Body(new ValidationPipe()) createDto: CreateUserProfileDto) {
    try {
      return await this.usuariosService.crearUsuarioCompleto(
        createDto.auth0Id,
        createDto.perfilTipo,
        createDto.perfilData
      );
    } catch (error) {
      throw new BadRequestException(`Error al crear usuario con perfil: ${error.message}`);
    }
  }

  @Post(':id/padre')
  @UseGuards(AuthGuard('jwt'))
  async createPadreProfile(
    @Param('id') id: string,
    @Body() createDto: CreatePadreDto
  ) {
    try {
      return await this.usuariosService.crearPerfilPadre(id, createDto);
    } catch (error) {
      throw new BadRequestException(`Error al crear perfil de padre: ${error.message}`);
    }
  }

  @Post(':id/estudiante')
  @UseGuards(AuthGuard('jwt'))
  async createEstudianteProfile(
    @Param('id') id: string,
    @Body() createDto: CreateEstudianteDto
  ) {
    try {
      return await this.usuariosService.crearPerfilEstudiante(id, createDto);
    } catch (error) {
      throw new BadRequestException(`Error al crear perfil de estudiante: ${error.message}`);
    }
  }

  @Post(':id/profesor')
  @UseGuards(AuthGuard('jwt'))
  async createProfesorProfile(
    @Param('id') id: string,
    @Body() createDto: CreateProfesorDto
  ) {
    try {
      return await this.usuariosService.crearPerfilProfesor(id, createDto);
    } catch (error) {
      throw new BadRequestException(`Error al crear perfil de profesor: ${error.message}`);
    }
  }

  @Post(':id/tesorero')
  @UseGuards(AuthGuard('jwt'))
  async createTesoreroProfile(
    @Param('id') id: string,
    @Body() createDto: CreateTesoreroDto
  ) {
    try {
      return await this.usuariosService.crearPerfilTesorero(id, createDto);
    } catch (error) {
      throw new BadRequestException(`Error al crear perfil de tesorero: ${error.message}`);
    }
  }

  @Post('asignar-estudiante')
  @UseGuards(AuthGuard('jwt'))
  async asignarEstudiante(@Body() asignarDto: AsignarEstudianteDto) {
    try {
      return await this.usuariosService.asignarEstudianteAPadre(
        asignarDto.padreId,
        asignarDto.estudianteId,
        asignarDto.esRepresentante
      );
    } catch (error) {
      throw new BadRequestException(`Error al asignar estudiante a padre: ${error.message}`);
    }
  }

  @Post('asignar-profesor-curso')
  @UseGuards(AuthGuard('jwt'))
  async asignarProfesorCurso(@Body() asignarDto: AsignarProfesorDto) {
    try {
      return await this.usuariosService.asignarProfesorACurso(
        asignarDto.profesorId,
        asignarDto.cursoId,
        asignarDto.esTutor
      );
    } catch (error) {
      throw new BadRequestException(`Error al asignar profesor a curso: ${error.message}`);
    }
  }


}