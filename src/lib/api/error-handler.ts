import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';
import { apiResponse, NotFoundError, ValidationError, ForbiddenError, UnauthorizedError } from './response';

/**
 * Error handler wrapper for API routes
 * Catches errors and returns appropriate responses
 */
export const withErrorHandler = (
  handler: (req: NextRequest, context: any) => Promise<NextResponse>
) => {
  return async (req: NextRequest, context: any) => {
    try {
      return await handler(req, context);
    } catch (error: any) {
      logger.error('API Error', {
        error: error.message,
        stack: error.stack,
        path: req.url,
        method: req.method,
      });
      
      // Handle custom errors
      if (error instanceof NotFoundError) {
        return apiResponse.notFound(error.resource);
      }
      
      if (error instanceof ValidationError) {
        return apiResponse.validationError(error.message, error.errors);
      }
      
      if (error instanceof ForbiddenError) {
        return apiResponse.forbidden(error.message);
      }
      
      if (error instanceof UnauthorizedError) {
        return apiResponse.unauthorized(error.message);
      }
      
      // Handle generic errors
      return apiResponse.serverError(error);
    }
  };
};

