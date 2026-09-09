import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { PaginationQueryDto } from './dto/pagination-query.dto.js';
import { Student } from '../../database/entities/student.entity.js';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
  ) {}

  async create(createStudentDto: CreateStudentDto) {
    const existingStudent = await this.studentsRepository.findOne({ where: { email: createStudentDto.email } });
    if (existingStudent) {
      throw new ConflictException(`Student with email ${createStudentDto.email} already exists`);
    }
    const student = this.studentsRepository.create({
      name: createStudentDto.name,
      email: createStudentDto.email,
      date_of_birth: createStudentDto.dateOfBirth,
    });
    return await this.studentsRepository.save(student);
  }

  async findAll(paginationQueryDto: PaginationQueryDto) {
    if (paginationQueryDto) {
      const { page, limit, name, email, courseId } = paginationQueryDto;
      const data = await this.studentsRepository.find({
        skip: (page - 1) * limit,
        take: limit,
        where: {
          ...(name ? { name: ILike(`%${name}%`) } : {}),
          ...(email ? { email: ILike(`%${email}%`) } : {}),
          ...(courseId ? { enrollments: { course: { id: courseId } } } : {}),
        },
        relations: {
          enrollments: {
            course: true,
          },
        },
      });
      return data;
    }
    return await this.studentsRepository.find();
  }

  async findOne(id: number) {
    const student = await this.studentsRepository.findOne({ where: { id } });
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
    return student;
  }

  async update(id: number, updateStudentDto: UpdateStudentDto) {
    const student = await this.findOne(id);
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
    await this.studentsRepository.update(id, {
      name: updateStudentDto.name,
      email: updateStudentDto.email,
      date_of_birth: updateStudentDto.dateOfBirth,
    });
    return await this.findOne(id);
  }

  async remove(id: number) {
    const student = await this.findOne(id);
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
    await this.studentsRepository.delete(id);
    return student;
  }

  async addCourses(id: number, code: string) {
    const student = await this.studentsRepository.findOne({ where: { id }, relations: { enrollments: { course: true } } });
    const course = await this.studentsRepository.manager.findOne('Course', {
      where: { code },
    });
    if (!student || !course) {
      throw new NotFoundException('Student or course not found');
    }
    if (student.enrollments.some((enrollment) => enrollment.course.code === code)) {
      throw new ConflictException('Student is already enrolled in this course');
    }
    const newEnrollment = this.studentsRepository.manager.create('Enrollment', {
      student,
      course,
    });
    return await this.studentsRepository.manager.save(newEnrollment);
  }

  async findCourses(id: number) {
    const student = await this.studentsRepository.findOne({ where: { id }, relations: { enrollments: { course: true } } });
    const enrollments = student?.enrollments || [];
    const courses = enrollments.map((enrollment) => enrollment.course);
    return courses;
  }
}
