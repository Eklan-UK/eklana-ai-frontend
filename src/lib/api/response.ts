import { NextResponse } from 'next/server';

/**
 * Custom error classes for better error handling
 */
export class NotFoundError extends Error {
  constructor(public resource: string) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public errors?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission") {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Not authenticated') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Centralized API response utility
 * Ensures consistent response format across all API routes
 */
export const apiResponse = {
  /**
   * Success response
   */
  success: (data: any, status = 200) => 
    NextResponse.json(
      { code: 'Success', data },
      { status }
    ),
  
  /**
   * Error response with custom code
   */
  error: (code: string, message: string, status: number, details?: any) =>
    NextResponse.json(
      { code, message, ...(details && { details }) },
      { status }
    ),
  
  /**
   * Not found response
   */
  notFound: (resource: string) =>
    NextResponse.json(
      { code: 'NotFoundError', message: `${resource} not found` },
      { status: 404 }
    ),
  
  /**
   * Server error response
   */
  serverError: (error: any, context?: string) =>
    NextResponse.json(
      { 
        code: 'ServerError', 
        message: error.message || 'Internal Server Error',
        ...(context && { context })
      },
      { status: 500 }
    ),
  
  /**
   * Forbidden response
   */
  forbidden: (message = "You don't have permission") =>
    NextResponse.json(
      { code: 'Forbidden', message },
      { status: 403 }
    ),
  
  /**
   * Validation error response
   */
  validationError: (message: string, errors?: any) =>
    NextResponse.json(
      { code: 'ValidationError', message, ...(errors && { errors }) },
      { status: 400 }
    ),
  
  /**
   * Unauthorized response
   */
  unauthorized: (message = 'Not authenticated') =>
    NextResponse.json(
      { code: 'AuthenticationError', message },
      { status: 401 }
    ),
};

// Error classes are already exported above

