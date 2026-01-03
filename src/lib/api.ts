// Use relative paths for Next.js API routes
import apiClient from './api/axios';
import { apiCache, createCacheKey } from './api-cache';

// Generic API request function using Axios with caching
// Better Auth handles authentication via cookies automatically
export async function apiRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    data?: any;
    params?: Record<string, any>;
    headers?: Record<string, string>;
    cache?: boolean; // Enable caching for GET requests
    cacheTTL?: number; // Cache TTL in milliseconds
  } = {}
): Promise<T> {
  const method = options.method || 'GET';
  const cacheKey = createCacheKey(endpoint, options.params);

  // Check cache for GET requests
  if (method === 'GET' && options.cache !== false) {
    const cached = apiCache.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  try {
    const response = await apiClient.request<T>({
      url: endpoint,
      method,
      data: options.data,
      params: options.params,
      headers: options.headers,
    });

    // Cache GET responses
    if (method === 'GET' && options.cache !== false) {
      apiCache.set(cacheKey, response.data, options.cacheTTL);
    }

    // Clear cache for mutations
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      // Clear related cache entries
      const endpointPattern = endpoint.split('/').slice(0, -1).join('/');
      if (endpointPattern) {
        apiCache.clearPattern(`^${endpointPattern}`);
      }
    }

    return response.data;
  } catch (error: any) {
    throw error;
  }
}

// Drill API
export const drillAPI = {
  // Get all drills
  getAll: (params?: {
    limit?: number;
    offset?: number;
    type?: string;
    difficulty?: string;
    studentEmail?: string;
    createdBy?: string;
    isActive?: boolean;
  }) => {
    return apiRequest<{ 
      code?: string;
      message?: string;
      data?: { 
        drills: any[]; 
        pagination: any;
      };
      drills?: any[];
      total?: number;
      limit?: number;
      offset?: number;
    }>('/drills', {
      method: 'GET',
      params,
    });
  },

  // Get drill by ID
  getById: (drillId: string) => {
    return apiRequest<{ drill: any }>(`/drills/${drillId}`);
  },

  // Create drill
  create: (data: any) => {
    return apiRequest<{ message: string; drill: any }>('/drills', {
      method: 'POST',
      data,
    });
  },

  // Update drill
  update: (drillId: string, data: any) => {
    return apiRequest<{ message: string; drill: any }>(`/drills/${drillId}`, {
      method: 'PUT',
      data,
    });
  },

  // Delete drill
  delete: (drillId: string) => {
    return apiRequest<{ message: string }>(`/drills/${drillId}`, {
      method: 'DELETE',
    });
  },

  // Get learner drills
  getLearnerDrills: (params?: {
    status?: 'pending' | 'in_progress' | 'completed';
    limit?: number;
    offset?: number;
  }) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        drills: any[];
        pagination: any;
      };
    }>('/drills/learner/my-drills', {
      method: 'GET',
      params,
    });
  },

  // Complete drill
  complete: (drillId: string, data: {
    drillAssignmentId: string;
    score: number;
    timeSpent: number;
    vocabularyResults?: any;
    roleplayResults?: any;
    matchingResults?: any;
    definitionResults?: any;
    grammarResults?: any;
    sentenceWritingResults?: any;
    summaryResults?: any;
    deviceInfo?: string;
    platform?: 'web' | 'ios' | 'android';
  }) => {
    return apiRequest<{
      code: string;
      message: string;
      data: {
        attempt: {
          id: string;
          score: number;
          timeSpent: number;
          completedAt: string;
        };
      };
    }>(`/drills/${drillId}/complete`, {
      method: 'POST',
      data,
    });
  },

  // Assign drill to learners
  assign: (drillId: string, data: {
    learnerIds: string[];
    dueDate?: string;
  }) => {
    return apiRequest<{
      code: string;
      message: string;
      data: {
        assignments: Array<{
          id: string;
          learnerId: string;
          status: string;
          dueDate?: string;
        }>;
      };
    }>(`/drills/${drillId}/assign`, {
      method: 'POST',
      data,
    });
  },
};

// Tutor API
export const tutorAPI = {
  // Get my drills
  getMyDrills: (params?: {
    limit?: number;
    offset?: number;
    type?: string;
    difficulty?: string;
    studentEmail?: string;
    isActive?: boolean;
  }) => {
    return apiRequest<{ drills: any[]; total: number; limit: number; offset: number }>(
      '/tutor/drills',
      {
        method: 'GET',
        params,
      }
    );
  },

  // Get my students
  getStudents: (params?: { limit?: number; offset?: number }) => {
    return apiRequest<{ students: any[]; total: number; limit: number; offset: number }>(
      '/tutor/students',
      {
        method: 'GET',
        params,
      }
    );
  },
};

// User API
export const userAPI = {
  // Get current user
  getCurrent: () => {
    return apiRequest<{ user: any; tutorProfile?: any; learnerProfile?: any }>('/users/current');
  },

  // Update current user
  update: (data: {
    firstName?: string;
    lastName?: string;
    username?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
  }) => {
    return apiRequest<{ code: string; message: string; data: { user: any } }>('/users/update', {
      method: 'PUT',
      data,
    });
  },

  // Upload avatar
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    return apiClient.post('/users/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }).then((response) => response.data);
  },

  // Delete current user
  delete: () => {
    return apiRequest<{ code: string; message: string }>('/users/current', {
      method: 'DELETE',
    });
  },

  // Onboard user (create Learner or Tutor profile)
  onboard: (role?: 'learner' | 'tutor', profileData?: any) => {
    return apiRequest<{
      code: string;
      message: string;
      data: {
        userId: string;
        role: string;
      };
    }>('/users/onboard', {
      method: 'POST',
      data: {
        role,
        ...profileData,
      },
    });
  },

  // Check if learner profile exists
  checkLearnerProfile: () => {
    return apiRequest<{
      code: string;
      message: string;
      hasProfile: boolean;
      role?: string;
    }>('/users/check-learner-profile');
  },
};

// Admin API
export const adminAPI = {
  // Get all users (admin only)
  getAllUsers: (params?: {
    limit?: number;
    offset?: number;
    role?: string;
    search?: string;
  }) => {
    return apiRequest<{
      users: any[];
      total: number;
      limit: number;
      offset: number;
    }>('/users', {
      method: 'GET',
      params,
    });
  },

  // Get user by ID
  getUserById: (userId: string) => {
    return apiRequest<{ user: any }>(`/users/${userId}`);
  },

  // Assign role
  assignRole: (userId: string, role: 'learner' | 'tutor' | 'admin', profileData?: any) => {
    return apiRequest<{
      code: string;
      message: string;
      data: { userId: string; role: string };
    }>('/admin/assign-role', {
      method: 'POST',
      data: { userId, role, profileData },
    });
  },

  // Assign tutor to student
  assignTutorToStudent: (studentId: string, tutorId: string) => {
    return apiRequest<{
      code: string;
      message: string;
      data: { learner: any };
    }>('/admin/assign-tutor', {
      method: 'POST',
      data: { studentId, tutorId },
    });
  },

  // Get all learners (admin only)
  getAllLearners: (params?: {
    limit?: number;
    offset?: number;
  }) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        learners: any[];
        pagination: any;
      };
    }>('/admin/learners', {
      method: 'GET',
      params,
    });
  },
};

