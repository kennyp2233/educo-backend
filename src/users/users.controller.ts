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
  ValidationPipe,
  Request
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

  @Get('email/:email')
  @UseGuards(AuthGuard('jwt'))
  async findByEmail(@Param('email') email: string) {
    const usuario = await this.usuariosService.buscarPorEmail(email);
    if (!usuario) {
      throw new NotFoundException(`Usuario con email ${email} no encontrado`);
    }
    return usuario;
  }

  // Se mantiene temporalmente para compatibilidad con sistemas que aún usan auth0Id
  @Get('auth0/:id')
  @UseGuards(AuthGuard('jwt'))
  async findByAuth0Id(@Param('id') id: string) {
    const usuario = await this.usuariosService.buscarPorId(id);
    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    return usuario;
  }

  @Get('me/profile')
  @UseGuards(AuthGuard('jwt'))
  async getMyProfile(@Request() req) {
    const userId = req.user.sub;
    const usuario = await this.usuariosService.buscarPorId(userId);
    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }
    return usuario;
  }

  @Post('perfil-completo')
  @UseGuards(AuthGuard('jwt'))
  async createUserWithProfile(@Body(new ValidationPipe()) createDto: CreateUserProfileDto) {
    try {
      // Obtener el email y password del usuario desde el JWT
      return { message: 'Utiliza el endpoint /auth/register para crear un nuevo usuario.' };
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