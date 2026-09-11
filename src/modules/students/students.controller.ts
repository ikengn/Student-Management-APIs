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
import { PaginationQueryDto } from './dto/pagination-query.dto.js';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { RoleGuard } from '../auth/guards/role.guard.js';
import { Roles } from '../auth/guards/role.decorator.js';
import { StudentsService } from './students.service.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { EnrollStudentDto } from './dto/enroll-student.dto.js';

@ApiTags('Students')
@Controller('students')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @Roles(['admin'])
  @UseGuards(RoleGuard)
  @ApiOperation({ 
    summary: 'Create a new student',
    description: 'Creates a new student with name, email, and date of birth. Returns the created student object.',
  })
  create(@Body() createStudentDto: CreateStudentDto) {
    return this.studentsService.create(createStudentDto);
  }

  @Get()
  @ApiOperation({
    summary: 'List students (paginated) — ADMIN',
    description: 'Returns a paginated list of students. Supports page/limit, case-insensitive search by name/email, and filtering by course enrollment via courseId.',
  })
  findAll(@Query() paginationQueryDto: PaginationQueryDto) {
    return this.studentsService.findAll(paginationQueryDto);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get a student by ID',
    description: 'Retrieves the details of a student by their ID.',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.studentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(['admin'])
  @UseGuards(RoleGuard)
  @ApiOperation({ 
    summary: 'Update a student',
    description: 'Updates the details of a student by their ID.',
  })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateStudentDto: UpdateStudentDto) {
    return this.studentsService.update(id, updateStudentDto);
  }

  @Delete(':id')
  @Roles(['admin'])
  @UseGuards(RoleGuard)
  @ApiOperation({ 
    summary: 'Delete a student — ADMIN',
    description: 'Deletes a student by their ID.',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.studentsService.remove(id);
  }

  @Post(':id/enroll')
  @Roles(['admin'])
  @UseGuards(RoleGuard)
  @ApiOperation({
    summary: 'Enroll a student into a course',
    description: 'Enrolls the student (by id) into a course identified by its code.',
  })
  addCourses(
    @Param('id', ParseIntPipe) id: number,
    @Body() enrollStudentDto: EnrollStudentDto,
  ) {
    const { code } = enrollStudentDto;
    return this.studentsService.addCourses(id, code);
  }

  @Get(':id/courses')
  @ApiOperation({ 
    summary: "List a student's enrolled courses",
    description: "Retrieves a list of courses that the student (by id) is enrolled in.",
  })
  findCourses(@Param('id', ParseIntPipe) id: number) {
    return this.studentsService.findCourses(id);
  }
}
