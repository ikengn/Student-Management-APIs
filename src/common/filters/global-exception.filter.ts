import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const isDbError = exception instanceof QueryFailedError;

    let status: number;
    let message: unknown;
    let error: string | undefined;

    if (isHttp) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        message = (res as Record<string, unknown>).message ?? exception.message;
        error = (res as Record<string, unknown>).error as string | undefined;
      } else {
        message = exception.message;
      }
    } else if (isDbError) {
      const code =
        (exception as QueryFailedError & { driverError?: { code?: string } })
          .driverError?.code ?? (exception as { code?: string }).code;
      if (code === '23505') {
        status = HttpStatus.CONFLICT; //unique violation
        error = 'Conflict';
        message = 'Resource already exists';
      } else {
        status = HttpStatus.BAD_REQUEST; //out-of-range
        error = 'Bad Request';
        message = 'Invalid request';
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    if (isHttp) {
      this.logger.warn(
        `${request.method} ${request.url} ${status} - ${JSON.stringify(message)}`,
      );
    } else if (isDbError) {
      this.logger.warn(
        `${request.method} ${request.url} ${status} - db error: ${(exception as Error).message}`,
      );
    } else {
      this.logger.error(
        `${request.method} ${request.url} ${status} - unhandled exception`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(error ? { error } : {}),
      message,
    });
  }
}
