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
            const auth0Id = req.user.sub;

            // Buscar el usuario local por su Auth0 ID
            const usuario = await this.findLocalUserByAuth0Id(auth0Id);

            if (!usuario) {
                throw new NotFoundException('Usuario no encontrado en el sistema local');
            }

            return await this.userInstitutionService.getInstitutionByUser(usuario.id);
        } catch (error) {
            this.logger.error(`Error al obtener instituciones del usuario actual: ${error.message}`);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(`Error al obtener instituciones: ${error.message}`);
        }
    }

    /**
     * Método auxiliar para buscar un usuario local por su ID de Auth0
     * @private
     */
    private async findLocalUserByAuth0Id(auth0Id: string) {
        return await this.userInstitutionService['prisma'].usuario.findUnique({
            where: { auth0Id }
        });
    }
}