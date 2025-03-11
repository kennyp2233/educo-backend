// src/notificacion/notificacion.controller.ts
import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    ParseIntPipe,
    ValidationPipe
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificacionService } from './notificacion.service';
import { CreateNotificacionDto } from './dto/create-notificacion.dto';
import { UpdateNotificacionDto } from './dto/update-notificacion.dto';
import { CreateNotificacionMultipleDto } from './dto/create-notificacion-multiple.dto';

@Controller('notificaciones')
@UseGuards(AuthGuard('jwt'))
export class NotificacionController {
    constructor(private readonly notificacionService: NotificacionService) { }

    @Get()
    findAll() {
        return this.notificacionService.findAll();
    }

    @Get('usuario/:usuarioId')
    findByUsuario(@Param('usuarioId') usuarioId: string) {
        return this.notificacionService.findByUsuario(usuarioId);
    }

    @Get('no-leidas/usuario/:usuarioId')
    findNoLeidasByUsuario(@Param('usuarioId') usuarioId: string) {
        return this.notificacionService.findNoLeidasByUsuario(usuarioId);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.notificacionService.findOne(id);
    }

    @Post()
    create(@Body(new ValidationPipe()) createNotificacionDto: CreateNotificacionDto) {
        return this.notificacionService.create(createNotificacionDto);
    }

    @Post('multiples')
    createMultiples(@Body(new ValidationPipe()) dto: CreateNotificacionMultipleDto) {
        return this.notificacionService.crearMultiples(dto.usuarioIds, {
            titulo: dto.titulo,
            mensaje: dto.mensaje,
            tipo: dto.tipo
        });
    }

    @Patch(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body(new ValidationPipe()) updateNotificacionDto: UpdateNotificacionDto
    ) {
        return this.notificacionService.update(id, updateNotificacionDto);
    }

    @Patch(':id/leer')
    marcarComoLeida(@Param('id', ParseIntPipe) id: number) {
        return this.notificacionService.marcarComoLeida(id);
    }

    @Patch('leer-todas/usuario/:usuarioId')
    marcarTodasComoLeidas(@Param('usuarioId') usuarioId: string) {
        return this.notificacionService.marcarTodasComoLeidas(usuarioId);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.notificacionService.remove(id);
    }

    @Delete('leidas/usuario/:usuarioId')
    eliminarNotificacionesLeidas(@Param('usuarioId') usuarioId: string) {
        return this.notificacionService.eliminarNotificacionesLeidas(usuarioId);
    }
}