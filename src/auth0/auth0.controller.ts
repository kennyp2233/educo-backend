// src/auth0/auth0.controller.ts

import { Controller, Post, Body, HttpException, HttpStatus, Get, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { Auth0Service } from './auth0.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { UsuariosService } from 'src/users/users.service';
import { Auth0UsersService } from './auth0-users.service';

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
        private readonly usuariosService: UsuariosService,
        private readonly auth0UsersService: Auth0UsersService
    ) { }

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

    @Get('user-profile')
    @UseGuards(AuthGuard('jwt'))
    async getUserProfile(@Req() req: RequestWithUser) {
        try {
            const auth0Id = req.user.sub;

            // Obtener usuario desde el servicio de usuarios
            const usuario = await this.usuariosService.buscarPorAuth0Id(auth0Id);

            if (!usuario) {
                throw new NotFoundException('Usuario no encontrado');
            }

            // Obtener roles del usuario
            let roles = [];
            try {
                // Intentar obtener roles desde Auth0 (si es posible)
                roles = await this.auth0Service.getUserRoles(auth0Id);
            } catch (error) {
                // Fallback: Extraer roles de la información local
                roles = await this.usuariosService.obtenerRolesUsuario(usuario.id);
                roles = roles.map(rolNombre => ({ name: rolNombre }));
            }

            // Obtener información adicional del usuario desde Auth0
            let userInfo = {
                sub: auth0Id,
                name: req.user.name || '',
                email: req.user.email || '',
                picture: req.user.picture || null
            };

            // Si falta información, intentar obtenerla desde el servicio de Auth0
            if (!userInfo.name || !userInfo.email || !userInfo.picture) {
                try {
                    // Obtener token de gestión para acceder a la API de Auth0
                    const token = req.headers.authorization.split(' ')[1];

                    // Obtener perfil completo de Auth0
                    const auth0Profile = await this.auth0UsersService.getUserInfo(token);

                    // Actualizar información faltante
                    userInfo = {
                        ...userInfo,
                        name: auth0Profile.name || userInfo.name,
                        email: auth0Profile.email || userInfo.email,
                        picture: auth0Profile.picture || userInfo.picture
                    };
                } catch (error) {
                    console.error('Error al obtener perfil desde Auth0:', error);
                    // Continuamos con la información que tenemos
                }
            }

            // Respuesta con la información del usuario
            return {
                user: {
                    sub: auth0Id,
                    name: userInfo.name,
                    email: userInfo.email,
                    picture: userInfo.picture,
                    roles: roles.map(r => typeof r === 'string' ? r : r.name),
                    userId: usuario.id
                }
            };
        } catch (error) {
            throw new HttpException(
                error.message || 'Error al obtener perfil de usuario',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }


}