import { NextRequest } from 'next/server';
import { ValidationError } from './response';
import { logger } from './logger';

/**
 * Parse request body with proper error handling
 * Centralizes JSON parsing logic
 */
export const parseRequestBody = async (req: NextRequest) => {
  try {
    const contentType = req.headers.get('content-type');
    
    if (!contentType || !contentType.includes('application/json')) {
      throw new ValidationError('Content-Type must be application/json');
    }
    
    const body = await req.json();
    
    if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
      throw new ValidationError('Request body is required and cannot be empty');
    }
    
    return body;
  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }
    
    logger.error('Error parsing request body', {
      error: error.message,
      contentType: req.headers.get('content-type'),
    });
    
    throw new ValidationError('Invalid JSON in request body');
  }
};

