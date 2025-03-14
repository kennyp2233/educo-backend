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
    ValidationPipe
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CarnetService } from './carnet.service';
import { CreateCarnetDto } from './dto/create-carnet.dto';
import { UpdateCarnetDto } from './dto/update-carnet.dto';

@Controller('carnets')
@UseGuards(AuthGuard('jwt'))
export class CarnetController {
    constructor(private readonly carnetService: CarnetService) { }

    /**
     * Obtener todos los carnets
     */
    @Get()
    findAllCarnets() {
        return this.carnetService.findAllCarnets();
    }

    /**
     * Obtener carnets por estado
     */
    @Get('estado/:estado')
    findCarnetsByEstado(@Param('estado') estado: string) {
        return this.carnetService.findCarnetsByEstado(estado);
    }

    /**
     * Obtener carnet por estudiante
     */
    @Get('estudiante/:estudianteId')
    findCarnetByEstudiante(@Param('estudianteId') estudianteId: string) {
        return this.carnetService.findCarnetByEstudiante(estudianteId);
    }

    /**
     * Obtener carnet por código QR
     */
    @Get('qr/:codigoQR')
    findCarnetByQR(@Param('codigoQR') codigoQR: string) {
        return this.carnetService.findCarnetByQR(codigoQR);
    }

    /**
     * Obtener carnet por ID
     */
    @Get(':id')
    findCarnetById(@Param('id', ParseIntPipe) id: number) {
        return this.carnetService.findCarnetById(id);
    }

    /**
     * Crear un nuevo carnet
     */
    @Post()
    createCarnet(@Body(new ValidationPipe()) createCarnetDto: CreateCarnetDto) {
        return this.carnetService.createCarnet(createCarnetDto);
    }

    /**
     * Actualizar un carnet
     */
    @Patch(':id')
    updateCarnet(
        @Param('id', ParseIntPipe) id: number,
        @Body(new ValidationPipe()) updateCarnetDto: UpdateCarnetDto
    ) {
        return this.carnetService.updateCarnet(id, updateCarnetDto);
    }

    /**
     * Renovar un carnet
     */
    @Patch(':id/renovar')
    renovarCarnet(
        @Param('id', ParseIntPipe) id: number,
        @Body('fechaExpiracion') fechaExpiracion: Date
    ) {
        return this.carnetService.renovarCarnet(id, fechaExpiracion);
    }

    /**
     * Invalidar un carnet
     */
    @Patch(':id/invalidar')
    invalidarCarnet(@Param('id', ParseIntPipe) id: number) {
        return this.carnetService.invalidarCarnet(id);
    }

    /**
     * Eliminar un carnet
     */
    @Delete(':id')
    deleteCarnet(@Param('id', ParseIntPipe) id: number) {
        return this.carnetService.deleteCarnet(id);
    }
}