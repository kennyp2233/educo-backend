// src/users/user-institution.controller.ts

import {
    Controller,
    Get,
    Param,
    UseGuards,
    Logger,
    NotFoundException,
    BadRequestException,
    Req
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserInstitutionService } from './user-institution.service';

interface RequestWithUser extends Request {
    user: {
        sub: string;
        email: string;
        [key: string]: any;
    }
}

@Controller('users/institutions')
@UseGuards(AuthGuard('jwt'))
export class UserInstitutionController {
    private readonly logger = new Logger(UserInstitutionController.name);

    constructor(private readonly userInstitutionService: UserInstitutionService) { }

    /**
     * Obtiene las instituciones asociadas a un usuario específico
     */
    @Get(':usuarioId')
    async getInstitutionsByUser(@Param('usuarioId') usuarioId: string) {
        try {
            return await this.userInstitutionService.getInstitutionByUser(usuarioId);
        } catch (error) {
            this.logger.error(`Error al obtener instituciones del usuario ${usuarioId}: ${error.message}`);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(`Error al obtener instituciones: ${error.message}`);
        }
    }

    /**
     * Obtiene las instituciones asociadas al usuario actual (basado en el token JWT)
     */
    @Get('me/assigned')
    async getMyInstitutions(@Req() req: RequestWithUser) {
        try {
            // Extraer el ID del usuario desde el objeto user (del token JWT)
            const userId = req.user.sub;

            // Ya tenemos el ID directamente del token, no necesitamos buscar por email
            return await this.userInstitutionService.getInstitutionByUser(userId);
        } catch (error) {
            this.logger.error(`Error al obtener instituciones del usuario actual: ${error.message}`);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(`Error al obtener instituciones: ${error.message}`);
        }
    }
}