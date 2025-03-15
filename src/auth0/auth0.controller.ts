// src/auth0/auth0.controller.ts

import { Controller, Post, Body, HttpException, HttpStatus, Get, UseGuards, Req } from '@nestjs/common';
import { Auth0Service } from './auth0.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';

interface RequestWithUser extends Request {
    user: {
        sub: string;
        [key: string]: any;
    }
}

@Controller('auth')
export class Auth0Controller {
    constructor(private readonly auth0Service: Auth0Service) { }

    @Post('login')
    async login(@Body() loginDto: LoginDto) {
        try {
            return await this.auth0Service.loginWithEmail(loginDto.email, loginDto.password);
        } catch (error) {
            throw new HttpException(
                error.message || 'Error al iniciar sesión',
                HttpStatus.UNAUTHORIZED
            );
        }
    }

    @Post('register')
    async register(@Body() registerDto: RegisterDto) {
        try {
            const user = await this.auth0Service.registerUser(
                registerDto.email,
                registerDto.password,
                registerDto.role,
                registerDto.fullName,
                registerDto.perfilData
            );
            return { success: true, message: 'Usuario registrado correctamente', user };
        } catch (error) {
            throw new HttpException(
                error.message || 'Error al registrar usuario',
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Post('refresh-token')
    async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
        try {
            return await this.auth0Service.refreshAccessToken(refreshTokenDto.refreshToken);
        } catch (error) {
            throw new HttpException(
                'Error al renovar el token',
                HttpStatus.UNAUTHORIZED
            );
        }
    }

    @Get('roles')
    async getRoles() {
        try {
            const roles = await this.auth0Service.getAvailableRoles();
            return roles.map(role => ({ id: role.id, name: role.name }));
        } catch (error) {
            throw new HttpException(
                'Error al obtener roles',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('user-roles')
    @UseGuards(AuthGuard('jwt'))
    async getUserRoles(@Req() req: RequestWithUser) {
        console.log('🔍 Headers recibidos:', req.headers);
        console.log('🔍 Token extraído:', req.headers.authorization);
        console.log('🔍 Usuario en req.user:', req.user);
        try {
            return await this.auth0Service.getUserRoles(req.user.sub);
        } catch (error) {
            throw new HttpException(
                'Error al obtener roles del usuario',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('user-role-test')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    async testRoleGuard() {
        return { message: 'Si puedes ver esto, tienes el rol de administrador' };
    }
}