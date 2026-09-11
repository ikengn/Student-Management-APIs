import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, HttpException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CoursesService } from './courses.service.js';
import { Course } from '../../database/entities/course.entity.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
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

describe('CoursesService', () => {
  let service: CoursesService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      findOne: vi.fn(),
      find: vi.fn(),
      findAndCount: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        { provide: getRepositoryToken(Course), useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(CoursesService);
  });

  describe('create', () => {
    it('creates a course when the code is unused', async () => {
      const dto = { name: 'Algorithms', code: 'CS101', description: 'd' };
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(dto);
      repo.save.mockResolvedValue({ id: 1, ...dto });

      const result = await service.create(dto as any);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { code: 'CS101' } });
      expect(repo.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 1, ...dto });
    });

    it('throws 409 on a duplicate code (never saves)', async () => {
      repo.findOne.mockResolvedValue({ id: 9, code: 'CS101' });
      const err = await rejectionOf(
        service.create({ name: 'x', code: 'CS101', description: '' } as any),
      );
      expectHttpError(err, ConflictException, 409);
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll (pagination + filters + meta)', () => {
    it('page 3, limit 4 -> skip 8, take 4, and returns items + pagination meta', async () => {
      repo.findAndCount.mockResolvedValue([[{ id: 1 }], 20]);
      const result = await service.findAll({ page: 3, limit: 4 } as any);
      const opts = repo.findAndCount.mock.calls[0][0];
      expect(opts.skip).toBe(8);
      expect(opts.take).toBe(4);
      expect(result).toEqual({
        items: [{ id: 1 }],
        meta: { total: 20, page: 3, limit: 4, total_pages: 5 },
      });
    });
    it('total_pages is ceil(total / limit)', async () => {
      repo.findAndCount.mockResolvedValue([[{ id: 1 }], 21]);
      const result = await service.findAll({ page: 1, limit: 10 } as any);
      expect(result.meta).toEqual({ total: 21, page: 1, limit: 10, total_pages: 3 });
    });
    it('no filters -> empty where', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ page: 1, limit: 10 } as any);
      expect(repo.findAndCount.mock.calls[0][0].where).toEqual({});
    });
    it('name/code filters -> corresponding where keys', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ page: 1, limit: 10, name: 'algo', code: 'CS' } as any);
      const where = repo.findAndCount.mock.calls[0][0].where;
      expect(where.name).toBeDefined();
      expect(where.code).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('returns the course when found', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });
      expect(await service.findOne(1)).toEqual({ id: 1 });
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });
    it('throws 404 when the course is missing', async () => {
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
      expect(repo.update).toHaveBeenCalledWith(1, { name: 'New' });
    });
    it('code only', async () => {
      await service.update(1, { code: 'CS999' } as any);
      expect(repo.update).toHaveBeenCalledWith(1, { code: 'CS999' });
    });
    it('description only', async () => {
      await service.update(1, { description: 'updated' } as any);
      expect(repo.update).toHaveBeenCalledWith(1, { description: 'updated' });
    });
    it('throws 404 (and never updates) when missing', async () => {
      repo.findOne.mockReset().mockResolvedValue(null);
      expectHttpError(await rejectionOf(service.update(999, { name: 'x' } as any)), NotFoundException, 404);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes and returns the removed course', async () => {
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
});


describe('CreateCourseDto validation — POST /courses', () => {
  const valid = { name: 'Algorithms', code: 'CS101', description: 'Intro' };
  it('accepts a valid payload', async () => {
    expect(await invalidProps(CreateCourseDto, valid)).toEqual([]);
  });
  it('rejects a missing / array name', async () => {
    expect(await invalidProps(CreateCourseDto, { ...valid, name: undefined })).toContain('name');
    expect(await invalidProps(CreateCourseDto, { ...valid, name: [] })).toContain('name');
  });
  it('rejects a missing / numeric code', async () => {
    expect(await invalidProps(CreateCourseDto, { ...valid, code: undefined })).toContain('code');
    expect(await invalidProps(CreateCourseDto, { ...valid, code: 123 })).toContain('code');
  });
  it('rejects a missing / non-string description', async () => {
    expect(await invalidProps(CreateCourseDto, { ...valid, description: undefined })).toContain('description');
    expect(await invalidProps(CreateCourseDto, { ...valid, description: 123 })).toContain('description');
  });
});

describe('UpdateCourseDto validation — PATCH /courses/:id (all fields optional)', () => {
  it('accepts an empty body', async () => {
    expect(await invalidProps(UpdateCourseDto, {})).toEqual([]);
  });
  it('accepts any single valid field', async () => {
    expect(await invalidProps(UpdateCourseDto, { name: 'New' })).toEqual([]);
    expect(await invalidProps(UpdateCourseDto, { code: 'CS999' })).toEqual([]);
    expect(await invalidProps(UpdateCourseDto, { description: 'd' })).toEqual([]);
  });
  it('rejects non-string name / code / description', async () => {
    expect(await invalidProps(UpdateCourseDto, { name: 123 })).toContain('name');
    expect(await invalidProps(UpdateCourseDto, { code: [] })).toContain('code');
    expect(await invalidProps(UpdateCourseDto, { description: {} })).toContain('description');
  });
});

describe('PaginationQueryDto validation — GET /courses', () => {
  it('accepts empty query (defaults apply)', async () => {
    expect(await invalidProps(PaginationQueryDto, {})).toEqual([]);
  });
  it('accepts valid string page/limit (coerced to numbers)', async () => {
    expect(await invalidProps(PaginationQueryDto, { page: '2', limit: '5' })).toEqual([]);
  });
  it('rejects non-numeric / below-1 page', async () => {
    expect(await invalidProps(PaginationQueryDto, { page: 'abc' })).toContain('page');
    expect(await invalidProps(PaginationQueryDto, { page: '0' })).toContain('page');
  });
  it('rejects limit below 1 or above the max (20)', async () => {
    expect(await invalidProps(PaginationQueryDto, { limit: '0' })).toContain('limit');
    expect(await invalidProps(PaginationQueryDto, { limit: '21' })).toContain('limit');
  });
  it('rejects a non-string name / code filter', async () => {
    expect(await invalidProps(PaginationQueryDto, { name: 123 })).toContain('name');
    expect(await invalidProps(PaginationQueryDto, { code: 123 })).toContain('code');
  });
});
