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
  isBookmarked?: boolean;
  learningJourneyPart?: 1 | 2 | 3 | 4 | 5;
  learningJourneyTopic?: string;
  /** Only return drills tagged with this source (currently only 'precision_clinic'). */
  source?: 'precision_clinic';
  /** Exclude drills tagged with this source (e.g. hide Precision Clinic drills from other drill surfaces). */
  excludeSource?: 'precision_clinic';
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
  const stringParams = [
    'search',
    'q',
    'role',
    'status',
    'type',
    'difficulty',
    'assignmentStatus',
    'learningJourneyTopic',
  ];
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

  const isBookmarked = searchParams.get('isBookmarked');
  if (isBookmarked === 'true' || isBookmarked === 'false') {
    params.isBookmarked = isBookmarked === 'true';
  }

  const assignmentStatus = searchParams.get('assignmentStatus');
  if (assignmentStatus === 'saved' || assignmentStatus === 'assigned') {
    params.assignmentStatus = assignmentStatus;
  }

  const learningJourneyPartRaw = searchParams.get('learningJourneyPart');
  if (learningJourneyPartRaw) {
    const part = Number(learningJourneyPartRaw);
    if (part === 1 || part === 2 || part === 3 || part === 4 || part === 5) {
      params.learningJourneyPart = part;
    }
  }

  const source = searchParams.get('source');
  if (source === 'precision_clinic') {
    params.source = source;
  }

  const excludeSource = searchParams.get('excludeSource');
  if (excludeSource === 'precision_clinic') {
    params.excludeSource = excludeSource;
  }
  
  return params;
};

