import { NextRequest } from 'next/server';
import config from './config';

export interface ParsedQueryParams {
  limit: number;
  offset: number;
  search?: string;
  role?: string;
  status?: string;
  type?: string;
  difficulty?: string;
  isActive?: boolean;
  assignmentStatus?: 'saved' | 'assigned';
  [key: string]: any;
}

/**
 * Parse query parameters from request URL
 * Centralizes query parameter parsing logic
 */
export const parseQueryParams = (req: NextRequest): ParsedQueryParams => {
  const { searchParams } = new URL(req.url);
  
  const params: ParsedQueryParams = {
    limit: parseInt(searchParams.get('limit') || String(config.defaultResLimit || 20), 10),
    offset: parseInt(searchParams.get('offset') || String(config.defaultResOffset || 0), 10),
  };
  
  // Optional string parameters
  const stringParams = ['search', 'q', 'role', 'status', 'type', 'difficulty', 'assignmentStatus'];
  stringParams.forEach(param => {
    const value = searchParams.get(param);
    if (value) {
      params[param] = value;
    }
  });
  
  // Boolean parameters
  const isActive = searchParams.get('isActive');
  if (isActive !== null) {
    params.isActive = isActive === 'true';
  }

  const assignmentStatus = searchParams.get('assignmentStatus');
  if (assignmentStatus === 'saved' || assignmentStatus === 'assigned') {
    params.assignmentStatus = assignmentStatus;
  }
  
  return params;
};

