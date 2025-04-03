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
    ParseIntPipe,
    Query
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermisosService } from './permisos.service';
import { CreatePermisoDto, TipoPermiso } from './dto/create-permiso.dto';
import { UpdatePermisoDto } from './dto/update-permiso.dto';
import { UsuariosService } from '../users/users.service';
import { Request } from 'express';

interface RequestWithUser extends Request {
    user: {
        sub: string;
        [key: string]: any;
    }
}

@Controller('permisos')
@UseGuards(AuthGuard('jwt'))
export class PermisosController {
    constructor(
        private readonly permisosService: PermisosService,
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
     * Obtener permisos por tipo
     */
    @Get('tipo/:tipo')
    async findByTipo(@Param('tipo') tipo: TipoPermiso) {
        return this.permisosService.findByTipo(tipo);
    }

    /**
     * Obtener permisos de un padre específico
     */
    @Get('padre/:padreId')
    async findByPadre(@Param('padreId') padreId: string) {
        return this.permisosService.findByPadre(padreId);
    }

    /**
     * Obtener permisos de un estudiante específico
     */
    @Get('estudiante/:estudianteId')
    async findByEstudiante(@Param('estudianteId') estudianteId: string) {
        return this.permisosService.findByEstudiante(estudianteId);
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
            // Ya no necesitamos buscar por auth0Id, el sub del token es directamente el ID del usuario
            const tutorId = req.user.sub;
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
     * Crear un nuevo permiso
     */
    @Post()
    async create(
        @Body(new ValidationPipe()) createPermisoDto: CreatePermisoDto
    ) {
        try {
            return await this.permisosService.create(createPermisoDto);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al crear permiso');
        }
    }

    /**
     * Actualizar un permiso existente
     */
    @Patch(':id')
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body(new ValidationPipe()) updatePermisoDto: UpdatePermisoDto
    ) {
        try {
            return await this.permisosService.update(id, updatePermisoDto);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al actualizar permiso');
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
            // El ID del usuario viene directamente del token JWT
            const tutorId = req.user.sub;
            return await this.permisosService.aprobar(id, tutorId, comentarios);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al aprobar permiso');
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
            // El ID del usuario viene directamente del token JWT
            const tutorId = req.user.sub;
            return await this.permisosService.rechazar(id, tutorId, comentarios);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Error al rechazar permiso');
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
            throw new BadRequestException(error.message || 'Error al validar permiso');
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
            throw new BadRequestException(error.message || 'Error al eliminar permiso');
        }
    }
}