// src/carnet/carnet.controller.ts
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
    Query,
    ValidationPipe
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CarnetService } from './carnet.service';
import { CreateCarnetDto } from './dto/create-carnet.dto';
import { UpdateCarnetDto } from './dto/update-carnet.dto';
import { CreatePermisoTemporalDto } from './dto/create-permiso-temporal.dto';
import { UpdatePermisoTemporalDto } from './dto/update-permiso-temporal.dto';

@Controller('accesos')
@UseGuards(AuthGuard('jwt'))
export class CarnetController {
    constructor(private readonly carnetService: CarnetService) { }

    // ========== Endpoints de Carnet ==========

    @Get('carnets')
    findAllCarnets() {
        return this.carnetService.findAllCarnets();
    }

    @Get('carnets/estado/:estado')
    findCarnetsByEstado(@Param('estado') estado: string) {
        return this.carnetService.findCarnetsByEstado(estado);
    }

    @Get('carnets/estudiante/:estudianteId')
    findCarnetByEstudiante(@Param('estudianteId') estudianteId: string) {
        return this.carnetService.findCarnetByEstudiante(estudianteId);
    }

    @Get('carnets/qr/:codigoQR')
    findCarnetByQR(@Param('codigoQR') codigoQR: string) {
        return this.carnetService.findCarnetByQR(codigoQR);
    }

    @Get('carnets/:id')
    findCarnetById(@Param('id', ParseIntPipe) id: number) {
        return this.carnetService.findCarnetById(id);
    }

    @Post('carnets')
    createCarnet(@Body(new ValidationPipe()) createCarnetDto: CreateCarnetDto) {
        return this.carnetService.createCarnet(createCarnetDto);
    }

    @Patch('carnets/:id')
    updateCarnet(
        @Param('id', ParseIntPipe) id: number,
        @Body(new ValidationPipe()) updateCarnetDto: UpdateCarnetDto
    ) {
        return this.carnetService.updateCarnet(id, updateCarnetDto);
    }

    @Patch('carnets/:id/renovar')
    renovarCarnet(
        @Param('id', ParseIntPipe) id: number,
        @Body('fechaExpiracion') fechaExpiracion: Date
    ) {
        return this.carnetService.renovarCarnet(id, fechaExpiracion);
    }

    @Patch('carnets/:id/invalidar')
    invalidarCarnet(@Param('id', ParseIntPipe) id: number) {
        return this.carnetService.invalidarCarnet(id);
    }

    @Delete('carnets/:id')
    deleteCarnet(@Param('id', ParseIntPipe) id: number) {
        return this.carnetService.deleteCarnet(id);
    }

    // ========== Endpoints de Permiso Temporal ==========

    @Get('permisos')
    findAllPermisos() {
        return this.carnetService.findAllPermisos();
    }

    @Get('permisos/padre/:padreId')
    findPermisosByPadre(@Param('padreId') padreId: string) {
        return this.carnetService.findPermisosByPadre(padreId);
    }

    @Get('permisos/estudiante/:estudianteId')
    findPermisosByEstudiante(@Param('estudianteId') estudianteId: string) {
        return this.carnetService.findPermisosByEstudiante(estudianteId);
    }

    @Get('permisos/qr/:codigoQR')
    findPermisoByQR(@Param('codigoQR') codigoQR: string) {
        return this.carnetService.findPermisoByQR(codigoQR);
    }

    @Get('permisos/:id')
    findPermisoById(@Param('id', ParseIntPipe) id: number) {
        return this.carnetService.findPermisoById(id);
    }

    @Post('permisos')
    createPermiso(@Body(new ValidationPipe()) createPermisoDto: CreatePermisoTemporalDto) {
        return this.carnetService.createPermiso(createPermisoDto);
    }

    @Patch('permisos/:id')
    updatePermiso(
        @Param('id', ParseIntPipe) id: number,
        @Body(new ValidationPipe()) updatePermisoDto: UpdatePermisoTemporalDto
    ) {
        return this.carnetService.updatePermiso(id, updatePermisoDto);
    }

    @Patch('permisos/:id/invalidar')
    invalidarPermiso(@Param('id', ParseIntPipe) id: number) {
        return this.carnetService.invalidarPermiso(id);
    }

    @Delete('permisos/:id')
    deletePermiso(@Param('id', ParseIntPipe) id: number) {
        return this.carnetService.deletePermiso(id);
    }
}