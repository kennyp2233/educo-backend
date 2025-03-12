// src/permisos/permisos.controller.ts
import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Req,
    ValidationPipe,
    NotFoundException,
    BadRequestException,
    UnauthorizedException,
    ParseIntPipe
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermisosAccesoService } from './permisos.service';
import { CreatePermisoAccesoDto } from './dto/create-permiso-acceso.dto';
import { UpdatePermisoAccesoDto } from './dto/update-permiso-acceso.dto';
import { UsuariosService } from '../users/users.service';
import { Request } from 'express';

interface RequestWithUser extends Request {
    user: {
        sub: string;
        [key: string]: any;
    }
}

@Controller('permisos-acceso')
@UseGuards(AuthGuard('jwt'))
export class PermisosAccesoController {
    constructor(
        private readonly permisosService: PermisosAccesoService,
        private readonly usuariosService: UsuariosService
    ) { }

    /**
     * Obtener todos los permisos (acceso admin)
     */
    @Get()
    async findAll() {
        return this.permisosService.findAll();
    }

    /**
     * Obtener permisos de un padre específico
     */
    @Get('padre/:padreId')
    async findByPadre(@Param('padreId') padreId: string) {
        return this.permisosService.findByPadre(padreId);
    }

    /**
     * Obtener permisos de un curso específico
     */
    @Get('curso/:cursoId')
    async findByCurso(@Param('cursoId', ParseIntPipe) cursoId: number) {
        return this.permisosService.findByCurso(cursoId);
    }

    /**
     * Obtener permisos pendientes para el tutor actual
     */
    @Get('pendientes')
    async findPendientesByTutor(@Req() req: RequestWithUser) {
        try {
            const tutorId = await this.getUserIdFromAuth0(req.user.sub);
            return this.permisosService.findPendientesByTutor(tutorId);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al obtener permisos pendientes');
        }
    }

    /**
     * Obtener un permiso por su ID
     */
    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number) {
        return this.permisosService.findOne(id);
    }

    /**
     * Obtener un permiso por su código QR
     */
    @Get('qr/:codigoQR')
    async findByQR(@Param('codigoQR') codigoQR: string) {
        return this.permisosService.findByQR(codigoQR);
    }

    /**
     * Crear un nuevo permiso de acceso
     */
    @Post()
    async create(
        @Body(new ValidationPipe()) createPermisoDto: CreatePermisoAccesoDto
    ) {
        try {
            return await this.permisosService.create(createPermisoDto);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al crear permiso de acceso');
        }
    }

    /**
     * Actualizar un permiso existente
     */
    @Patch(':id')
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body(new ValidationPipe()) updatePermisoDto: UpdatePermisoAccesoDto
    ) {
        try {
            return await this.permisosService.update(id, updatePermisoDto);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al actualizar permiso de acceso');
        }
    }

    /**
     * Aprobar un permiso
     */
    @Post(':id/aprobar')
    async aprobar(
        @Param('id', ParseIntPipe) id: number,
        @Body('comentarios') comentarios: string,
        @Req() req: RequestWithUser
    ) {
        try {
            const tutorId = await this.getUserIdFromAuth0(req.user.sub);
            return await this.permisosService.aprobar(id, tutorId, comentarios);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al aprobar permiso de acceso');
        }
    }

    /**
     * Rechazar un permiso
     */
    @Post(':id/rechazar')
    async rechazar(
        @Param('id', ParseIntPipe) id: number,
        @Body('comentarios') comentarios: string,
        @Req() req: RequestWithUser
    ) {
        try {
            const tutorId = await this.getUserIdFromAuth0(req.user.sub);
            return await this.permisosService.rechazar(id, tutorId, comentarios);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al rechazar permiso de acceso');
        }
    }

    /**
     * Marcar un permiso como utilizado (validación entrada)
     */
    @Post('validar/:codigoQR')
    async marcarUtilizado(@Param('codigoQR') codigoQR: string) {
        try {
            return await this.permisosService.marcarUtilizado(codigoQR);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al validar permiso de acceso');
        }
    }

    /**
     * Eliminar un permiso
     */
    @Delete(':id')
    async remove(@Param('id', ParseIntPipe) id: number) {
        try {
            return await this.permisosService.remove(id);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al eliminar permiso de acceso');
        }
    }

    /**
     * Método auxiliar para obtener el ID de usuario local a partir del ID de Auth0
     */
    private async getUserIdFromAuth0(auth0Id: string): Promise<string> {
        const usuario = await this.usuariosService.buscarPorAuth0Id(auth0Id);

        if (!usuario) {
            throw new UnauthorizedException('Usuario no encontrado');
        }

        return usuario.id;
    }
}