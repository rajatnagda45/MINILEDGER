import type { RequestHandler } from 'express';
import type { AuthService } from '../modules/auth/auth.js';

export function authenticate(auth: AuthService): RequestHandler {
  return async (request, _response, next) => {
    try {
      request.auth = await auth.authenticate(request.header('authorization'));
      next();
    } catch (error) {
      next(error);
    }
  };
}

