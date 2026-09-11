import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const SENSITIVE_KEYS = ['password', 'password_hash'];

function fields(...pairs: string[]): string {
  return pairs.filter(Boolean).join(' ');
}

function kv(key: string, value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  return typeof value === 'number' ? `${key}=${value}` : `${key}="${value}"`;
}

function describeBody(body: unknown): string {
  if (!body || typeof body !== 'object') {
    return '';
  }
  return fields(
    ...Object.entries(body as Record<string, unknown>).map(([k, v]) =>
      SENSITIVE_KEYS.includes(k) ? kv(k, '***') : kv(k, v),
    ),
  );
}

type Body = Record<string, any> | undefined;
type Result = Record<string, any> | undefined;

function describe(
  method: string,
  url: string,
  body: Body,
  result: Result,
): string | null {
  const seg = url.split('?')[0].replace(/\/+$/, '').split('/').filter(Boolean);
  const [resource, id, sub] = seg;

  if (resource === 'students') {
    if (method === 'POST' && sub === 'enroll') {
      return fields(
        'enrolled student',
        kv('id', result?.student?.id ?? Number(id)),
        kv('name', result?.student?.name),
        'in course',
        kv('id', result?.course?.id),
        kv('code', result?.course?.code ?? body?.code),
      );
    }
    if (method === 'POST' && !id) {
      return fields(
        'created student',
        kv('name', result?.name ?? body?.name),
        kv('email', result?.email ?? body?.email),
      );
    }
    if (method === 'PATCH' && id) {
      return fields('updated student', kv('id', Number(id)), describeBody(body));
    }
    if (method === 'DELETE' && id) {
      return fields('deleted student', kv('id', Number(id)));
    }
  }

  if (resource === 'courses') {
    if (method === 'POST' && !id) {
      return fields(
        'created course',
        kv('name', result?.name ?? body?.name),
        kv('code', result?.code ?? body?.code),
      );
    }
    if (method === 'PATCH' && id) {
      return fields('updated course', kv('id', Number(id)), describeBody(body));
    }
    if (method === 'DELETE' && id) {
      return fields('deleted course', kv('id', Number(id)));
    }
  }

  if (resource === 'auth') {
    if (id === 'register') {
      return fields('registered user', kv('email', body?.email));
    }
    if (id === 'login') {
      return fields('login', kv('email', body?.email));
    }
  }

  return null;
}

@Injectable()
export class OperationInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Operation');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method;
    const url: string = req.originalUrl ?? req.url;
    const body: Body = req.body;

    if (method === 'GET') {
      return next.handle(); 
    }

    return next.handle().pipe(
      tap((result) => {
        const message =
          describe(method, url, body, result as Result) ??
          `${method} ${url} ${describeBody(body)}`.trim();
        this.logger.log(message);
      }),
    );
  }
}
