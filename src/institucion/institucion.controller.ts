// src/institucion/institucion.controller.ts
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
import { InstitucionService } from './institucion.service';
import { CreateInstitucionDto } from './dto/create-institucion.dto';
import { UpdateInstitucionDto } from './dto/update-institucion.dto';
import { CreateCursoDto } from './dto/create-curso.dto';
import { UpdateCursoDto } from './dto/update-curso.dto';

@Controller('instituciones')
@UseGuards(AuthGuard('jwt'))
export class InstitucionController {
    constructor(private readonly institucionService: InstitucionService) { }

    // ========== Endpoints de Institución ==========

    @Get()
    findAllInstituciones() {
        return this.institucionService.findAllInstituciones();
    }

    @Get(':id')
    findInstitucionById(@Param('id', ParseIntPipe) id: number) {
        return this.institucionService.findInstitucionById(id);
    }

    @Post()
    createInstitucion(@Body(new ValidationPipe()) createInstitucionDto: CreateInstitucionDto) {
        return this.institucionService.createInstitucion(createInstitucionDto);
    }

    @Patch(':id')
    updateInstitucion(
        @Param('id', ParseIntPipe) id: number,
        @Body(new ValidationPipe()) updateInstitucionDto: UpdateInstitucionDto
    ) {
        return this.institucionService.updateInstitucion(id, updateInstitucionDto);
    }

    @Delete(':id')
    deleteInstitucion(@Param('id', ParseIntPipe) id: number) {
        return this.institucionService.deleteInstitucion(id);
    }

    // ========== Endpoints de Curso ==========

    @Get('cursos/all')
    findAllCursos() {
        return this.institucionService.findAllCursos();
    }

    @Get(':id/cursos')
    findCursosByInstitucion(@Param('id', ParseIntPipe) id: number) {
        return this.institucionService.findCursosByInstitucion(id);
    }

    @Get('cursos/:id')
    findCursoById(@Param('id', ParseIntPipe) id: number) {
        return this.institucionService.findCursoById(id);
    }

    @Post('cursos')
    createCurso(@Body(new ValidationPipe()) createCursoDto: CreateCursoDto) {
        return this.institucionService.createCurso(createCursoDto);
    }

    @Patch('cursos/:id')
    updateCurso(
        @Param('id', ParseIntPipe) id: number,
        @Body(new ValidationPipe()) updateCursoDto: UpdateCursoDto
    ) {
        return this.institucionService.updateCurso(id, updateCursoDto);
    }

    @Delete('cursos/:id')
    deleteCurso(@Param('id', ParseIntPipe) id: number) {
        return this.institucionService.deleteCurso(id);
    }
}