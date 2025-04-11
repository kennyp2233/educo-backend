// src/recaudacion/recaudacion.controller.ts
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
import { RecaudacionService } from './recaudacion.service';
import { CreateRecaudacionDto } from './dto/create-recaudacion.dto';
import { UpdateRecaudacionDto } from './dto/update-recaudacion.dto';
import { CreateAbonoDto } from './dto/create-abono.dto';
import { UpdateAbonoDto } from './dto/update-abono.dto';
import { AbonoDirectoDto } from './dto/abono-directo.dto';

@Controller('recaudaciones')
@UseGuards(AuthGuard('jwt'))
export class RecaudacionController {
    constructor(private readonly recaudacionService: RecaudacionService) { }

    // ========== Endpoints de Recaudación ==========

    @Get()
    findAllRecaudaciones() {
        return this.recaudacionService.findAllRecaudaciones();
    }

    @Get('tesorero/:tesoreroId')
    findRecaudacionesByTesorero(@Param('tesoreroId') tesoreroId: string) {
        return this.recaudacionService.findRecaudacionesByTesorero(tesoreroId);
    }

    @Get(':id')
    findRecaudacionById(@Param('id', ParseIntPipe) id: number) {
        return this.recaudacionService.findRecaudacionById(id);
    }

    @Post()
    createRecaudacion(@Body(new ValidationPipe()) createRecaudacionDto: CreateRecaudacionDto) {
        return this.recaudacionService.createRecaudacion(createRecaudacionDto);
    }

    @Patch(':id')
    updateRecaudacion(
        @Param('id', ParseIntPipe) id: number,
        @Body(new ValidationPipe()) updateRecaudacionDto: UpdateRecaudacionDto
    ) {
        return this.recaudacionService.updateRecaudacion(id, updateRecaudacionDto);
    }

    @Patch(':id/cerrar')
    cerrarRecaudacion(@Param('id', ParseIntPipe) id: number) {
        return this.recaudacionService.cerrarRecaudacion(id);
    }

    @Delete(':id')
    deleteRecaudacion(@Param('id', ParseIntPipe) id: number) {
        return this.recaudacionService.deleteRecaudacion(id);
    }

    // ========== Endpoints de Abono ==========

    @Get(':id/abonos')
    findAbonosByRecaudacion(@Param('id', ParseIntPipe) id: number) {
        return this.recaudacionService.findAbonosByRecaudacion(id);
    }

    @Get('abonos/padre/:padreId')
    findAbonosByPadre(@Param('padreId') padreId: string) {
        return this.recaudacionService.findAbonosByPadre(padreId);
    }

    @Get('abonos/estudiante/:estudianteId')
    findAbonosByEstudiante(@Param('estudianteId') estudianteId: string) {
        return this.recaudacionService.findAbonosByEstudiante(estudianteId);
    }

    @Get('abonos/:id')
    findAbonoById(@Param('id', ParseIntPipe) id: number) {
        return this.recaudacionService.findAbonoById(id);
    }

    @Post('abonos')
    createAbono(@Body(new ValidationPipe()) createAbonoDto: CreateAbonoDto) {
        return this.recaudacionService.createAbono(createAbonoDto);
    }

    @Post('abono-directo')
    createAbonoDirecto(
        @Body(new ValidationPipe()) abonoDto: AbonoDirectoDto
    ) {
        return this.recaudacionService.crearAbonoDirecto(
            abonoDto.recaudacionId,
            abonoDto.padreId,
            abonoDto.estudianteId,
            abonoDto.monto,
            abonoDto.comprobante
        );
    }
    @Patch('abonos/:id')
    updateAbono(
        @Param('id', ParseIntPipe) id: number,
        @Body(new ValidationPipe()) updateAbonoDto: UpdateAbonoDto
    ) {
        return this.recaudacionService.updateAbono(id, updateAbonoDto);
    }

    @Patch('abonos/:id/aprobar')
    aprobarAbono(@Param('id', ParseIntPipe) id: number) {
        return this.recaudacionService.aprobarAbono(id);
    }

    @Patch('abonos/:id/rechazar')
    rechazarAbono(@Param('id', ParseIntPipe) id: number) {
        return this.recaudacionService.rechazarAbono(id);
    }

    @Delete('abonos/:id')
    deleteAbono(@Param('id', ParseIntPipe) id: number) {
        return this.recaudacionService.deleteAbono(id);
    }
}