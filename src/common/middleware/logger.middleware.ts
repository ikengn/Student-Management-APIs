import { Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

const logger = new Logger('GlobalLogger');

export function loggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const { method, originalUrl } = req;
  const start = Date.now();

  res.on('finish', () => {
    const { statusCode } = res;
    const ms = Date.now() - start;
    const message = `${method} ${originalUrl} ${statusCode} - ${ms}ms`;

    if (statusCode >= 500) {
      logger.error(message);
    } else if (statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.log(message);
    }
  });

  next();
}
