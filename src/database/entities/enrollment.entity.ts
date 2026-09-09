import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  type Relation,
} from 'typeorm';
import * as StudentEntity from './student.entity.js';
import * as CourseEntity from './course.entity.js';

@Entity('enrollments')
@Unique(['student_id', 'course_id'])
export class Enrollment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: false })
  student_id: number;

  @Column({ type: 'int', nullable: false })
  course_id: number;

  @ManyToOne(() => StudentEntity.Student, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  student: Relation<StudentEntity.Student>;

  @ManyToOne(() => CourseEntity.Course, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'course_id' })
  course: Relation<CourseEntity.Course>;
}
