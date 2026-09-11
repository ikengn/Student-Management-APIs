import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, HttpException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StudentsService } from './students.service.js';
import { Student } from '../../database/entities/student.entity.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { EnrollStudentDto } from './dto/enroll-student.dto.js';
import { PaginationQueryDto } from './dto/pagination-query.dto.js';

const rejectionOf = (p: Promise<unknown>): Promise<any> =>
  p.then(
    () => {
      throw new Error('Expected the call to reject, but it resolved');
    },
    (e) => e,
  );

const expectHttpError = (err: unknown, type: any, status: number) => {
  expect(err).toBeInstanceOf(type);
  expect((err as HttpException).getStatus()).toBe(status);
};

const invalidProps = async (cls: any, obj: unknown): Promise<string[]> =>
  (await validate(plainToInstance(cls, obj))).map((e) => e.property);

describe('StudentsService', () => {
  let service: StudentsService;
  let repo: any;
  let manager: any;

  beforeEach(async () => {
    manager = { findOne: vi.fn(), create: vi.fn(), save: vi.fn() };
    repo = {
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      manager,
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: getRepositoryToken(Student), useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(StudentsService);
  });

  describe('create', () => {
    it('maps dateOfBirth -> date_of_birth and saves when the email is unused', async () => {
      const dto = { name: 'Ann', email: 'ann@x.com', dateOfBirth: new Date('2000-01-01') };
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue({ ...dto });
      repo.save.mockResolvedValue({ id: 1, ...dto });

      const result = await service.create(dto as any);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { email: 'ann@x.com' } });
      expect(repo.create).toHaveBeenCalledWith({
        name: 'Ann',
        email: 'ann@x.com',
        date_of_birth: dto.dateOfBirth,
      });
      expect(result).toEqual({ id: 1, ...dto });
    });

    it('throws 409 on a duplicate email (never saves)', async () => {
      repo.findOne.mockResolvedValue({ id: 9, email: 'ann@x.com' });
      const err = await rejectionOf(
        service.create({ name: 'Ann', email: 'ann@x.com', dateOfBirth: new Date() } as any),
      );
      expectHttpError(err, ConflictException, 409);
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll (pagination + filters)', () => {
    it('page 2, limit 5 -> skip 5, take 5', async () => {
      repo.find.mockResolvedValue([{ id: 1 }]);
      const result = await service.findAll({ page: 2, limit: 5 } as any);
      const opts = repo.find.mock.calls[0][0];
      expect(opts.skip).toBe(5);
      expect(opts.take).toBe(5);
      expect(result).toEqual([{ id: 1 }]);
    });

    it('page 1 -> skip 0', async () => {
      repo.find.mockResolvedValue([]);
      await service.findAll({ page: 1, limit: 10 } as any);
      expect(repo.find.mock.calls[0][0].skip).toBe(0);
    });

    it('no filters -> empty where', async () => {
      repo.find.mockResolvedValue([]);
      await service.findAll({ page: 1, limit: 10 } as any);
      expect(repo.find.mock.calls[0][0].where).toEqual({});
    });

    it('name/email/courseId filters -> corresponding where keys', async () => {
      repo.find.mockResolvedValue([]);
      await service.findAll({ page: 1, limit: 10, name: 'a', email: 'b', courseId: 3 } as any);
      const where = repo.find.mock.calls[0][0].where;
      expect(where.name).toBeDefined();
      expect(where.email).toBeDefined();
      expect(where.enrollments).toEqual({ course: { id: 3 } });
    });
  });

  describe('findOne', () => {
    it('returns the student when found', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });
      expect(await service.findOne(1)).toEqual({ id: 1 });
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('throws 404 when the student is missing', async () => {
      repo.findOne.mockResolvedValue(null);
      expectHttpError(await rejectionOf(service.findOne(999)), NotFoundException, 404);
    });
  });

  describe('update (field-by-field)', () => {
    beforeEach(() => {
      repo.findOne.mockResolvedValue({ id: 1, name: 'stored' });
      repo.update.mockResolvedValue({ affected: 1 });
    });

    it('name only', async () => {
      await service.update(1, { name: 'New' } as any);
      expect(repo.update).toHaveBeenCalledWith(1, { name: 'New', email: undefined, date_of_birth: undefined });
    });
    it('email only', async () => {
      await service.update(1, { email: 'new@x.com' } as any);
      expect(repo.update).toHaveBeenCalledWith(1, { name: undefined, email: 'new@x.com', date_of_birth: undefined });
    });
    it('dateOfBirth only (mapped)', async () => {
      const dob = new Date('1999-05-05');
      await service.update(1, { dateOfBirth: dob } as any);
      expect(repo.update).toHaveBeenCalledWith(1, { name: undefined, email: undefined, date_of_birth: dob });
    });
    it('all fields', async () => {
      const dob = new Date('2001-02-03');
      await service.update(1, { name: 'N', email: 'e@x.com', dateOfBirth: dob } as any);
      expect(repo.update).toHaveBeenCalledWith(1, { name: 'N', email: 'e@x.com', date_of_birth: dob });
    });
    it('empty body is a no-op update that returns the student', async () => {
      const result = await service.update(1, {} as any);
      expect(repo.update).toHaveBeenCalledWith(1, { name: undefined, email: undefined, date_of_birth: undefined });
      expect(result).toEqual({ id: 1, name: 'stored' });
    });
    it('throws 404 (and never updates) when the student is missing', async () => {
      repo.findOne.mockReset().mockResolvedValue(null);
      expectHttpError(await rejectionOf(service.update(999, { name: 'x' } as any)), NotFoundException, 404);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes and returns the removed student', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });
      repo.delete.mockResolvedValue({ affected: 1 });
      expect(await service.remove(1)).toEqual({ id: 1 });
      expect(repo.delete).toHaveBeenCalledWith(1);
    });
    it('throws 404 (and never deletes) when missing', async () => {
      repo.findOne.mockResolvedValue(null);
      expectHttpError(await rejectionOf(service.remove(999)), NotFoundException, 404);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('addCourses (enroll)', () => {
    it('creates an enrollment when student & course exist and are not already linked', async () => {
      const student = { id: 1, enrollments: [] };
      const course = { id: 2, code: 'CS101' };
      const enrollment = { id: 3, student, course };
      repo.findOne.mockResolvedValue(student);
      manager.findOne.mockResolvedValue(course);
      manager.create.mockReturnValue(enrollment);
      manager.save.mockResolvedValue(enrollment);

      const result = await service.addCourses(1, 'CS101');

      expect(manager.findOne).toHaveBeenCalledWith('Course', { where: { code: 'CS101' } });
      expect(manager.create).toHaveBeenCalledWith('Enrollment', { student, course });
      expect(result).toEqual(enrollment);
    });
    it('throws 404 when the student is missing', async () => {
      repo.findOne.mockResolvedValue(null);
      manager.findOne.mockResolvedValue({ id: 2, code: 'CS101' });
      expectHttpError(await rejectionOf(service.addCourses(1, 'CS101')), NotFoundException, 404);
      expect(manager.save).not.toHaveBeenCalled();
    });
    it('throws 404 when the course code does not exist', async () => {
      repo.findOne.mockResolvedValue({ id: 1, enrollments: [] });
      manager.findOne.mockResolvedValue(null);
      expectHttpError(await rejectionOf(service.addCourses(1, 'NOPE')), NotFoundException, 404);
      expect(manager.save).not.toHaveBeenCalled();
    });
    it('throws 409 when already enrolled', async () => {
      repo.findOne.mockResolvedValue({ id: 1, enrollments: [{ course: { code: 'CS101' } }] });
      manager.findOne.mockResolvedValue({ id: 2, code: 'CS101' });
      expectHttpError(await rejectionOf(service.addCourses(1, 'CS101')), ConflictException, 409);
      expect(manager.save).not.toHaveBeenCalled();
    });
  });

  describe('findCourses', () => {
    it("maps the student's enrollments to their courses", async () => {
      const courseA = { id: 2 };
      const courseB = { id: 3 };
      repo.findOne.mockResolvedValue({ id: 1, enrollments: [{ course: courseA }, { course: courseB }] });
      expect(await service.findCourses(1)).toEqual([courseA, courseB]);
    });
    it('returns [] for an empty enrollment list', async () => {
      repo.findOne.mockResolvedValue({ id: 1, enrollments: [] });
      expect(await service.findCourses(1)).toEqual([]);
    });
    it('returns [] when the student is not found (no throw)', async () => {
      repo.findOne.mockResolvedValue(null);
      expect(await service.findCourses(999)).toEqual([]);
    });
  });
});

describe('CreateStudentDto validation — POST /students', () => {
  const valid = { name: 'Ann', email: 'ann@x.com', dateOfBirth: '2000-01-01' };
  it('accepts a valid payload', async () => {
    expect(await invalidProps(CreateStudentDto, valid)).toEqual([]);
  });
  it('rejects a missing / non-string name', async () => {
    expect(await invalidProps(CreateStudentDto, { ...valid, name: undefined })).toContain('name');
    expect(await invalidProps(CreateStudentDto, { ...valid, name: 123 })).toContain('name');
  });
  it('rejects an invalid / missing email', async () => {
    expect(await invalidProps(CreateStudentDto, { ...valid, email: 'bad' })).toContain('email');
    expect(await invalidProps(CreateStudentDto, { ...valid, email: undefined })).toContain('email');
  });
  it('rejects a missing dateOfBirth', async () => {
    expect(await invalidProps(CreateStudentDto, { ...valid, dateOfBirth: undefined })).toContain('dateOfBirth');
  });
  it('rejects a numeric / boolean dateOfBirth (the input that used to 500)', async () => {
    expect(await invalidProps(CreateStudentDto, { ...valid, dateOfBirth: 0 })).toContain('dateOfBirth');
    expect(await invalidProps(CreateStudentDto, { ...valid, dateOfBirth: true })).toContain('dateOfBirth');
  });
  it('rejects a non-ISO / object / array dateOfBirth', async () => {
    expect(await invalidProps(CreateStudentDto, { ...valid, dateOfBirth: 'not-a-date' })).toContain('dateOfBirth');
    expect(await invalidProps(CreateStudentDto, { ...valid, dateOfBirth: {} })).toContain('dateOfBirth');
    expect(await invalidProps(CreateStudentDto, { ...valid, dateOfBirth: [] })).toContain('dateOfBirth');
  });
});

describe('UpdateStudentDto validation — PATCH /students/:id (all fields optional)', () => {
  it('accepts an empty body', async () => {
    expect(await invalidProps(UpdateStudentDto, {})).toEqual([]);
  });
  it('accepts any single valid field', async () => {
    expect(await invalidProps(UpdateStudentDto, { name: 'New' })).toEqual([]);
    expect(await invalidProps(UpdateStudentDto, { email: 'new@x.com' })).toEqual([]);
    expect(await invalidProps(UpdateStudentDto, { dateOfBirth: '1999-05-05' })).toEqual([]);
  });
  it('rejects a non-string name', async () => {
    expect(await invalidProps(UpdateStudentDto, { name: 123 })).toContain('name');
  });
  it('rejects an invalid email', async () => {
    expect(await invalidProps(UpdateStudentDto, { email: 'bad' })).toContain('email');
  });
  it('rejects a numeric / non-ISO dateOfBirth', async () => {
    expect(await invalidProps(UpdateStudentDto, { dateOfBirth: 0 })).toContain('dateOfBirth');
    expect(await invalidProps(UpdateStudentDto, { dateOfBirth: 'not-a-date' })).toContain('dateOfBirth');
  });
});

describe('EnrollStudentDto validation — POST /students/:id/enroll', () => {
  it('accepts a valid code', async () => {
    expect(await invalidProps(EnrollStudentDto, { code: 'CS101' })).toEqual([]);
  });
  it('rejects a missing code', async () => {
    expect(await invalidProps(EnrollStudentDto, {})).toContain('code');
  });
  it('rejects an empty-string code', async () => {
    expect(await invalidProps(EnrollStudentDto, { code: '' })).toContain('code');
  });
  it('rejects a non-string code (number / array)', async () => {
    expect(await invalidProps(EnrollStudentDto, { code: 123 })).toContain('code');
    expect(await invalidProps(EnrollStudentDto, { code: [] })).toContain('code');
  });
});

describe('PaginationQueryDto validation — GET /students', () => {
  it('accepts empty query (defaults apply)', async () => {
    expect(await invalidProps(PaginationQueryDto, {})).toEqual([]);
  });
  it('accepts valid string page/limit (coerced to numbers)', async () => {
    expect(await invalidProps(PaginationQueryDto, { page: '2', limit: '5' })).toEqual([]);
  });
  it('rejects non-numeric / below-1 / negative page', async () => {
    expect(await invalidProps(PaginationQueryDto, { page: 'abc' })).toContain('page');
    expect(await invalidProps(PaginationQueryDto, { page: '0' })).toContain('page');
    expect(await invalidProps(PaginationQueryDto, { page: '-1' })).toContain('page');
  });
  it('rejects limit below 1 or above the max (20)', async () => {
    expect(await invalidProps(PaginationQueryDto, { limit: '0' })).toContain('limit');
    expect(await invalidProps(PaginationQueryDto, { limit: '21' })).toContain('limit');
  });
  it('rejects a non-numeric courseId', async () => {
    expect(await invalidProps(PaginationQueryDto, { courseId: 'abc' })).toContain('courseId');
  });
  it('rejects a non-string name/email filter', async () => {
    expect(await invalidProps(PaginationQueryDto, { name: 123 })).toContain('name');
    expect(await invalidProps(PaginationQueryDto, { email: 123 })).toContain('email');
  });
});
