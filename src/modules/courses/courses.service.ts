import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Course } from '../../database/entities/course.entity.js';
import { Repository, ILike } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { PaginationQueryDto } from './dto/pagination-query.dto.js';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
  ) {}

  async create(createCourseDto: CreateCourseDto) {
    const existingCourse = await this.courseRepository.findOne({ where: { code: createCourseDto.code } });
    if (existingCourse) {
      throw new ConflictException(`Course with code ${createCourseDto.code} already exists`);
    }
    const course = this.courseRepository.create(createCourseDto);
    return await this.courseRepository.save(course);
  }

  async findAll(paginationQueryDto: PaginationQueryDto) {
    const { page, limit, name, code } = paginationQueryDto;
    const [data, total] = await this.courseRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      where: {
        ...(name ? { name: ILike(`%${name}%`) } : {}),
        ...(code ? { code: ILike(`%${code}%`) } : {}),
      },
    });
    return {
      items: data,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const course = await this.courseRepository.findOne({ where: { id } });
    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }
    return course;
  }

  async update(id: number, updateCourseDto: UpdateCourseDto) {
    const course = await this.findOne(id);
    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }
    await this.courseRepository.update(id, updateCourseDto);
    return await this.findOne(id);
  }

  async remove(id: number) {
    const course = await this.findOne(id);
    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }
    await this.courseRepository.delete(id);
    return course;
  }
}
