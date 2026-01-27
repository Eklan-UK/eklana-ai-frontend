import { z } from 'zod';
import { ValidationError } from './response';

/**
 * Validate request data against Zod schema
 * Centralizes validation logic
 * @throws ValidationError if validation fails
 */
export const validateRequest = <T>(
  schema: z.ZodSchema<T>,
  data: any
): T => {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    throw new ValidationError(
      'Validation failed',
      result.error.issues // Always use .issues, not .errors
    );
  }
  
  return result.data;
};

