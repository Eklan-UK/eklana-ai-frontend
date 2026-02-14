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
    return apiRequest<{ 
      code?: string;
      data?: { drill: any };
      drill?: any;
    }>(`/drills/${drillId}`);
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
    listeningResults?: any;
    fillBlankResults?: any;
    sentenceResults?: any;
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

  // Assign drill to users
  assign: (drillId: string, data: {
    userIds: string[];
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

// Pronunciation API - All routes now use Next.js API routes
export const pronunciationAPI = {
  // Get all pronunciations (admin)
  getAll: (params?: {
    limit?: number;
    offset?: number;
    difficulty?: string;
    isActive?: boolean;
    search?: string;
  }) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        pronunciations: any[];
        pagination: any;
      };
    }>('/pronunciations', {
      method: 'GET',
      params,
    });
  },

  // Create pronunciation (admin)
  create: (formData: FormData) => {
    return apiClient.post('/pronunciations', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }).then((response) => response.data);
  },

  // Assign pronunciation to learners
  assign: (pronunciationId: string, data: { learnerIds: string[]; dueDate?: string }) => {
    return apiRequest<{ message: string; data: any }>(`/pronunciations/${pronunciationId}/assign`, {
      method: 'POST',
      data,
    });
  },

  // Get learner's pronunciations
  getLearnerPronunciations: (params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        pronunciations: any[];
        pagination: any;
      };
    }>('/pronunciations/learner/my-pronunciations', {
      method: 'GET',
      params,
    });
  },

  // Submit pronunciation attempt
  submitAttempt: (pronunciationId: string, data: {
    assignmentId?: string;
    audioBase64: string;
    passingThreshold?: number;
  }) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        attempt: any;
        assignment: any;
      };
    }>(`/pronunciations/${pronunciationId}/attempt`, {
      method: 'POST',
      data,
    });
  },

  // Get pronunciation attempts
  getAttempts: (pronunciationId: string, learnerId?: string) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        attempts: any[];
        assignment: any;
      };
    }>(`/pronunciations/${pronunciationId}/attempts`, {
      method: 'GET',
      params: learnerId ? { learnerId } : undefined,
    });
  },

  // Get learner pronunciation analytics
  getLearnerAnalytics: (learnerId: string) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        learner: any;
        overall: any;
        problemAreas: any;
        accuracyTrend: any[];
        wordStats: any[];
      };
    }>(`/pronunciations/learner/${learnerId}/analytics`, {
      method: 'GET',
    });
  },
  // Get overall pronunciation analytics
  getOverallAnalytics: (days?: number) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        stats: any;
        problemAreas: any;
        difficultWords: any[];
      };
    }>('/pronunciations/analytics/overall', {
      method: 'GET',
      params: days ? { days } : undefined,
    });
  },

  // Create pronunciation attempt from drill
  createDrillAttempt: (data: {
    text: string;
    audioBase64: string;
    drillId?: string;
    drillAttemptId?: string;
    drillType?: string;
    passingThreshold?: number;
  }) => {
    return apiRequest<{
      code?: string;
      message?: string;
      attempt?: any;
    }>('/pronunciations/drill-attempt', {
      method: 'POST',
      data,
    });
  },
};

// Pronunciation Problems API (New Global System)
export const pronunciationProblemAPI = {
  // Get all pronunciation problems (global, visible to all)
  getAll: (params?: {
    difficulty?: string;
    isActive?: boolean;
  }) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        problems: any[];
      };
    }>('/pronunciation-problems', {
      method: 'GET',
      params,
    });
  },

  // Create pronunciation problem (admin)
  create: (data: {
    title: string;
    description?: string;
    phonemes: string[];
    type?: 'word' | 'sound' | 'sentence';
    difficulty?: string;
    estimatedTimeMinutes?: number;
    order?: number;
  }) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        problem: any;
      };
    }>('/pronunciation-problems', {
      method: 'POST',
      data,
    });
  },

  // Get problem by slug with words and progress
  getBySlug: (slug: string) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        problem: any;
        words: any[];
        progress?: any; // Only for learners
      };
    }>(`/pronunciation-problems/${slug}`, {
      method: 'GET',
    });
  },

  // Get words in a problem
  getWords: (slug: string) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        words: any[];
      };
    }>(`/pronunciation-problems/${slug}/words`, {
      method: 'GET',
    });
  },

  // Add word to problem (admin)
  addWord: (slug: string, formData: FormData) => {
    return apiClient.post(`/pronunciation-problems/${slug}/words`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }).then((response) => response.data);
  },
};

// Pronunciation Words API
export const pronunciationWordAPI = {
  // Submit word attempt
  submitAttempt: (wordId: string, data: {
    audioBase64: string;
    passingThreshold?: number;
  }) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        attempt: any;
        progress: any;
      };
    }>(`/pronunciation-words/${wordId}/attempt`, {
      method: 'POST',
      data,
    });
  },
};

// Learner Challenges API
export const learnerChallengesAPI = {
  // Get challenging words for a learner
  getChallenges: (learnerId: string) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        learner: any;
        challenges: any;
        words: any[];
        weakPhonemes: string[];
      };
    }>(`/learners/${learnerId}/pronunciation-challenges`, {
      method: 'GET',
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
  onboard: (role?: 'user' | 'tutor', profileData?: any) => {
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
  checkProfile: () => {
    return apiRequest<{
      code: string;
      message: string;
      hasProfile: boolean;
      role?: string;
    }>('/users/check-profile');
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
  assignRole: (userId: string, role: 'user' | 'tutor' | 'admin', profileData?: any) => {
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

  // Get drill assignments for a learner (admin/tutor)
  getLearnerDrillAssignments: (learnerId: string) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        assignments: any[];
        statistics: {
          total: number;
          completed: number;
          inProgress: number;
          pending: number;
          overdue: number;
          averageScore: number;
          completionRate: number;
        };
      };
    }>(`/admin/learners/${learnerId}/drill-assignments`, {
      method: 'GET',
    });
  },
};

// Daily Focus API
export const dailyFocusAPI = {
  // Get today's daily focus
  getToday: () => {
    return apiRequest<{
      code?: string;
      message?: string;
      dailyFocus?: any;
    }>('/daily-focus/today', {
      method: 'GET',
    });
  },

  // Get daily focus by ID
  getById: (id: string) => {
    return apiRequest<{
      code?: string;
      message?: string;
      dailyFocus?: any;
    }>(`/daily-focus/${id}`, {
      method: 'GET',
    });
  },

  // Get progress for a daily focus
  getProgress: (id: string) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        progress: any;
      };
    }>(`/daily-focus/${id}/progress`, {
      method: 'GET',
    });
  },

  // Save progress for a daily focus
  saveProgress: (id: string, data: {
    currentQuestionIndex: number;
    answers: Array<{
      questionType: string;
      questionIndex: number;
      userAnswer: any;
      isCorrect?: boolean;
      isSubmitted: boolean;
    }>;
    isCompleted?: boolean;
    finalScore?: number;
  }) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        progress: any;
      };
    }>(`/daily-focus/${id}/progress`, {
      method: 'POST',
      data,
    });
  },

  // Complete daily focus
  complete: (id: string, data: {
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    timeSpent?: number;
    answers?: any[];
  }) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        message: string;
        score: number;
        streakUpdated: boolean;
        badgeUnlocked: {
          badgeId: string;
          badgeName: string;
          milestone: number;
        } | null;
      };
    }>(`/daily-focus/${id}/complete`, {
      method: 'POST',
      data,
    });
  },
};

// Streak API
export const streakAPI = {
  // Get user's streak data
  getStreak: () => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        currentStreak: number;
        longestStreak: number;
        lastActivityDate: string | null;
        streakStartDate: string | null;
        todayCompleted: boolean;
        yesterdayCompleted: boolean;
        weeklyActivity: Array<{
          date: string;
          completed: boolean;
          score?: number;
        }>;
        badges: Array<{
          badgeId: string;
          badgeName: string;
          unlockedAt: string;
          milestone: number;
        }>;
      };
    }>('/users/streak', {
      method: 'GET',
    });
  },
};

