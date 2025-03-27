// src/auth0/auth0.controller.ts

import {
    Controller,
    Post,
    Body,
    HttpException,
    HttpStatus,
    Get,
    UseGuards,
    Req,
} from '@nestjs/common';
import { Auth0Service } from './auth0.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import {
    AuthResponse,
    ErrorResponse,
    RegisterResponse
} from './types/auth-response.types';

interface RequestWithUser extends Request {
    user: {
        sub: string;
        [key: string]: any;
    }
}

@Controller('auth')
export class Auth0Controller {
    constructor(
        private readonly auth0Service: Auth0Service,
    ) { }

    @Post('login')
    async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
        try {
            return await this.auth0Service.loginWithEmail(loginDto.email, loginDto.password);
        } catch (error) {
            const errorResponse: ErrorResponse = {
                status: HttpStatus.UNAUTHORIZED,
                message: error.message || 'Error al iniciar sesión'
            };
            throw new HttpException(errorResponse, HttpStatus.UNAUTHORIZED);
        }
    }

    @Post('register')
    async register(@Body() registerDto: RegisterDto): Promise<RegisterResponse> {
        try {
            return await this.auth0Service.registerUser(
                registerDto.email,
                registerDto.password,
                registerDto.role,
                registerDto.fullName,
                registerDto.perfilData
            );
        } catch (error) {
            const errorResponse: ErrorResponse = {
                status: HttpStatus.BAD_REQUEST,
                message: error.message || 'Error al registrar usuario'
            };
            throw new HttpException(errorResponse, HttpStatus.BAD_REQUEST);
        }
    }

    @Post('refresh-token')
    async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthResponse> {
        try {
            return await this.auth0Service.refreshAccessToken(refreshTokenDto.refreshToken);
        } catch (error) {
            const errorResponse: ErrorResponse = {
                status: HttpStatus.UNAUTHORIZED,
                message: 'Error al renovar el token'
            };
            throw new HttpException(errorResponse, HttpStatus.UNAUTHORIZED);
        }
    }

    @Get('roles')
    async getRoles() {
        try {
            const roles = await this.auth0Service.getAvailableRoles();
            return {
                roles: roles.map(role => ({ id: role.id, name: role.name }))
            };
        } catch (error) {
            const errorResponse: ErrorResponse = {
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                message: 'Error al obtener roles'
            };
            throw new HttpException(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('user-roles')
    @UseGuards(AuthGuard('jwt'))
    async getUserRoles(@Req() req: RequestWithUser) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const profile = await this.auth0Service.getUserProfile(token);

            return {
                roles: profile.user.roles,
                rolesApproved: profile.user.rolesApproved
            };
        } catch (error) {
            const errorResponse: ErrorResponse = {
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                message: 'Error al obtener roles del usuario'
            };
            throw new HttpException(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }


    @Get('user-role-test')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    async testRoleGuard() {
        return { message: 'Si puedes ver esto, tienes el rol de administrador' };
    }

    @Get('user-profile')
    @UseGuards(AuthGuard('jwt'))
    async getUserProfile(@Req() req: RequestWithUser): Promise<AuthResponse> {
        try {
            const token = req.headers.authorization.split(' ')[1];
            return await this.auth0Service.getUserProfile(token);
        } catch (error) {
            const errorResponse: ErrorResponse = {
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                message: error.message || 'Error al obtener perfil de usuario'
            };
            throw new HttpException(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}