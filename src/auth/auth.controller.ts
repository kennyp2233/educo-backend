// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Get,
  UseGuards,
  Request,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) { }

  @Post('login')
  async login(@Body(ValidationPipe) loginDto: LoginDto) {
    try {
      return await this.authService.login(loginDto);
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.UNAUTHORIZED,
          message: error.message || 'Error al iniciar sesión',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @Post('register')
  async register(@Body(ValidationPipe) registerDto: RegisterDto) {
    try {
      return await this.authService.register(registerDto);
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          message: error.message || 'Error al registrar usuario',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('refresh-token')
  async refreshToken(@Body(ValidationPipe) refreshTokenDto: RefreshTokenDto) {
    try {
      return await this.authService.refreshToken(refreshTokenDto);
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.UNAUTHORIZED,
          message: 'Error al renovar el token',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @Get('roles')
  async getRoles() {
    try {
      const roles = await this.prisma.rol.findMany();
      return {
        roles: roles,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Error al obtener roles',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('user-roles')
  @UseGuards(JwtAuthGuard)
  async getUserRoles(@Request() req) {
    try {
      const userId = req.user.sub;

      // Buscar roles del usuario
      const userRoles = await this.prisma.usuarioRol.findMany({
        where: { usuarioId: userId },
        include: { rol: true },
      });

      const roles = userRoles.map(ur => ur.rol.nombre);
      const rolesWithApproval = userRoles.map(ur => ({
        role: ur.rol.nombre,
        status: ur.estadoAprobacion
      }));

      return {
        roles,
        rolesApproved: rolesWithApproval,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Error al obtener roles del usuario',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('user-role-test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async testRoleGuard() {
    return { message: 'Si puedes ver esto, tienes el rol de administrador' };
  }

  @Get('user-profile')
  @UseGuards(JwtAuthGuard)
  async getUserProfile(@Request() req) {
    try {
      const userId = req.user.sub;
      return await this.authService.getUserProfile(userId);
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Error al obtener perfil de usuario',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}