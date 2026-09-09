import {
  Controller,
  Post,
  Patch,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { RoleGuard } from '../auth/guards/role.guard.js';
import { Roles } from '../auth/guards/role.decorator.js';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { PaginationQueryDto } from './dto/pagination-query.dto.js';
import { CoursesService } from './courses.service.js';

@ApiTags('Courses')
@Controller('courses')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @Roles(['admin'])
  @UseGuards(RoleGuard)
  @ApiOperation({ 
    summary: 'Create a course — ADMIN',
    description: 'Creates a new course with name and code.',
  })
  create(@Body() createCourseDto: CreateCourseDto) {
    return this.coursesService.create(createCourseDto);
  }

  @Get()
  @ApiOperation({
    summary: 'List courses (paginated)',
    description: 'Returns a paginated list of courses. Supports page/limit and case-insensitive search by name/code.',
  })
  findAll(@Query() paginationQueryDto: PaginationQueryDto) {
    return this.coursesService.findAll(paginationQueryDto);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get a course by ID',
    description: 'Retrieves the details of a course by its ID.',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.findOne(id);
  }

  @Patch(':id')
  @Roles(['admin'])
  @UseGuards(RoleGuard)
  @ApiOperation({ 
    summary: 'Update a course — ADMIN',
    description: 'Updates the details of a course by its ID.',
  })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateCourseDto: UpdateCourseDto) {
    return this.coursesService.update(id, updateCourseDto);
  }

  @Delete(':id')
  @Roles(['admin'])
  @UseGuards(RoleGuard)
  @ApiOperation({ 
    summary: 'Delete a course — ADMIN',
    description: 'Deletes a course by its ID.'
   })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.remove(id);
  }
}
