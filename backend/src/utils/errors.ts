import type { ErrorRequestHandler, RequestHandler } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (_request, _response, next) => {
  next(new AppError(404, 'NOT_FOUND', 'The requested resource was not found.'));
};

function isMalformedJson(error: unknown): error is SyntaxError & { status: number; body: unknown } {
  return error instanceof SyntaxError
    && 'status' in error
    && error.status === 400
    && 'body' in error;
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (isMalformedJson(error)) {
    response.status(400).json({
      error: { code: 'MALFORMED_JSON', message: 'The request body contains invalid JSON.' },
    });
    return;
  }
  if (error instanceof MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    response.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? 'RECEIPT_TOO_LARGE' : 'RECEIPT_UPLOAD_ERROR',
        message: tooLarge ? 'The receipt image exceeds the maximum allowed size.' : 'The receipt upload could not be processed.',
      },
    });
    return;
  }
  if (error instanceof ZodError) {
    response.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Please check the submitted details.', details: error.flatten() },
    });
    return;
  }
  if (error instanceof AppError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message, ...(error.details === undefined ? {} : { details: error.details }) },
    });
    return;
  }
  console.error('Unhandled request error', error instanceof Error ? error.message : error);
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
};

