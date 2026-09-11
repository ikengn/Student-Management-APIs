import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

const rejectionOf = (p: Promise<unknown>): Promise<any> =>
  p.then(
    () => {
      throw new Error('Expected rejection, but got resolved instead');
    },
    (e) => e,
  );

const expectHttpError = (err: unknown, type: any, status: number) => {
  expect(err).toBeInstanceOf(type);
  expect((err as HttpException).getStatus()).toBe(status);
};

const invalidProps = async (cls: any, obj: unknown): Promise<string[]> =>
  (await validate(plainToInstance(cls, obj))).map((e) => e.property);

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findByEmail: ReturnType<typeof vi.fn>;
    createUser: ReturnType<typeof vi.fn>;
  };
  let jwtService: { signAsync: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    usersService = { findByEmail: vi.fn(), createUser: vi.fn() };
    jwtService = { signAsync: vi.fn().mockResolvedValue('signed.jwt.token') };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('hashes the password, creates the user with role "user", and returns a JWT', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createUser.mockResolvedValue({ id: 1, email: 'a@b.com', role: 'user' });

      const result = await service.register({ email: 'a@b.com', password: 'secret123' } as any);

      expect(usersService.findByEmail).toHaveBeenCalledWith('a@b.com');
      const created = usersService.createUser.mock.calls[0][0];
      expect(created.email).toBe('a@b.com');
      expect(created.role).toBe('user');
      expect(created.password_hash).not.toBe('secret123'); // never stores plaintext
      expect(await bcrypt.compare('secret123', created.password_hash)).toBe(true);
      expect(jwtService.signAsync).toHaveBeenCalledWith({ email: 'a@b.com', role: 'user', sub: 1 });
      expect(result).toEqual({ access_token: 'signed.jwt.token' });
    });

    it('throws 401 on a duplicate email and never creates a user', async () => {
      usersService.findByEmail.mockResolvedValue({ id: 1, email: 'a@b.com' });
      const err = await rejectionOf(
        service.register({ email: 'a@b.com', password: 'secret123' } as any),
      );
      expectHttpError(err, UnauthorizedException, 401);
      expect(usersService.createUser).not.toHaveBeenCalled();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a JWT (carrying the user role) for valid credentials', async () => {
      const password_hash = await bcrypt.hash('secret123', 10);
      usersService.findByEmail.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        role: 'admin',
        password_hash,
      });

      const result = await service.login({ email: 'a@b.com', password: 'secret123' } as any);

      expect(jwtService.signAsync).toHaveBeenCalledWith({ email: 'a@b.com', role: 'admin', sub: 1 });
      expect(result).toEqual({ access_token: 'signed.jwt.token' });
    });

    it('throws 401 when the user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const err = await rejectionOf(
        service.login({ email: 'x@y.com', password: 'secret123' } as any),
      );
      expectHttpError(err, UnauthorizedException, 401);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('throws 401 when the password is invalid', async () => {
      const password_hash = await bcrypt.hash('the-real-one', 10);
      usersService.findByEmail.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        role: 'user',
        password_hash,
      });
      const err = await rejectionOf(
        service.login({ email: 'a@b.com', password: 'wrong-password' } as any),
      );
      expectHttpError(err, UnauthorizedException, 401);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });
});


describe.each([
  ['RegisterDto', RegisterDto],
  ['LoginDto', LoginDto],
])('%s validation (400 on bad input)', (_label, Dto) => {
  const valid = { email: 'admin@example.com', password: 'secret123' };

  it('accepts a valid payload', async () => {
    expect(await invalidProps(Dto, valid)).toEqual([]);
  });

  // email param
  it('rejects a malformed email', async () => {
    expect(await invalidProps(Dto, { ...valid, email: 'not-an-email' })).toContain('email');
  });
  it('rejects a missing email', async () => {
    expect(await invalidProps(Dto, { ...valid, email: undefined })).toContain('email');
  });
  it('rejects a non-string email', async () => {
    expect(await invalidProps(Dto, { ...valid, email: 123 })).toContain('email');
  });

  // password param
  it('rejects a password shorter than 6 chars', async () => {
    expect(await invalidProps(Dto, { ...valid, password: '123' })).toContain('password');
  });
  it('rejects a missing password', async () => {
    expect(await invalidProps(Dto, { ...valid, password: undefined })).toContain('password');
  });
  it('rejects a non-string password', async () => {
    expect(await invalidProps(Dto, { ...valid, password: 123456 })).toContain('password');
  });
});
