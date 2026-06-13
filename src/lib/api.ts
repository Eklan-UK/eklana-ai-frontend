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
    assignmentStatus?: 'saved' | 'assigned';
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
      cache: false,
    });
  },

  // Complete drill
  complete: (drillId: string, data: {
    drillAssignmentId: string;
    score: number;
    timeSpent: number;
    vocabularyResults?: any;
    pronunciationResults?: any;
    roleplayResults?: any;
    matchingResults?: any;
    definitionResults?: any;
    grammarResults?: any;
    sentenceWritingResults?: any;
    summaryResults?: any;
    listeningResults?: any;
    fillBlankResults?: any;
    keyPhrasesResults?: any;
    sentenceResults?: any;
    deviceInfo?: string;
    platform?: 'web' | 'ios' | 'android';
    performanceReviewSnapshot?: Record<string, unknown>;
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

  /** Update assigned learner's name (tutor only). */
  updateStudentName: (
    studentId: string,
    data: { firstName: string; lastName: string }
  ) => {
    return apiRequest<{
      code: string;
      data: {
        student: { id: string; firstName: string; lastName: string; name: string };
      };
    }>(`/tutor/students/${studentId}`, {
      method: 'PATCH',
      data,
    });
  },

  getGoogleCalendarStatus: () => {
    return apiRequest<{
      code: string;
      data: { connected: boolean };
    }>('/tutor/google-calendar/status', {
      method: 'GET',
      cache: false,
    });
  },

  disconnectGoogleCalendar: () => {
    return apiRequest<{
      code: string;
      data: { disconnected: boolean };
    }>('/tutor/google-calendar/disconnect', {
      method: 'DELETE',
    });
  },
};

// User API
export const userAPI = {
  // Get current user
  getCurrent: (options?: { cache?: boolean }) => {
    return apiRequest<{ user: any; profile?: any; tutorProfile?: any; learnerProfile?: any }>(
      '/users/current',
      { cache: options?.cache }
    );
  },

  updatePreferences: (data: {
    nationality?: string;
    language?: string;
    learningGoal?: string;
    learningGoals?: string[];
    theme?: 'system' | 'light' | 'dark';
    notificationPreferences?: {
      learningReminders: boolean;
      specialOffers: boolean;
      subscriptionExpires: boolean;
    };
    lessonPreferences?: {
      eklanTalks?: boolean;
      chatTranslation?: boolean;
      englishAccent?: string;
      voiceTone?: string;
      speakingSpeed?: string;
    };
  }) => {
    return apiRequest<{
      code: string;
      message: string;
      data: {
        nationality?: string;
        language?: string;
        learningGoal?: string;
        learningGoals?: string[];
        theme?: 'system' | 'light' | 'dark';
        notificationPreferences?: {
          learningReminders: boolean;
          specialOffers: boolean;
          subscriptionExpires: boolean;
        };
        lessonPreferences?: {
          eklanTalks: boolean;
          chatTranslation: boolean;
          englishAccent: string;
          voiceTone: string;
          speakingSpeed: string;
        };
      };
    }>('/users/preferences', {
      method: 'PATCH',
      data,
    });
  },

  // Update current user profile (name, email, etc.)
  update: (data: {
    firstName?: string;
    lastName?: string;
    username?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
  }) => {
    return apiRequest<{ code: string; message: string; data: { user: any } }>('/users/profile', {
      method: 'PATCH',
      data,
    });
  },

  // Upload avatar image file (multipart)
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);

    return apiClient.post('/users/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }).then((response) => response.data);
  },

  // Set avatar by URL (for preset avatars)
  setPresetAvatar: (avatarUrl: string) => {
    return apiRequest<{ code: string; message: string; data: { avatarUrl: string } }>(
      '/users/avatar',
      { method: 'PATCH', data: { avatarUrl } }
    );
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

  // Check if learner profile exists (not cached — result changes after onboarding)
  checkProfile: () => {
    return apiRequest<{
      code: string;
      message: string;
      hasProfile: boolean;
      role?: string;
    }>('/users/check-profile', { cache: false });
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

  // Assign tutor to student (creates TutorAssignment, multiple tutors per student supported)
  assignTutorToStudent: (studentId: string, tutorId: string) => {
    return apiRequest<{
      code: string;
      message: string;
      data: { assignmentId: string };
    }>('/admin/assign-tutor', {
      method: 'POST',
      data: { studentId, tutorId },
    });
  },

  // Remove tutor–student assignment
  unassignTutorFromStudent: (studentId: string, tutorId: string) => {
    return apiRequest<{
      code: string;
      message: string;
    }>('/admin/unassign-tutor', {
      method: 'DELETE',
      data: { studentId, tutorId },
    });
  },

  // List learners assigned to a specific tutor
  getTutorAssignedStudents: (tutorId: string, params?: { search?: string }) => {
    const qs = params?.search ? `?search=${encodeURIComponent(params.search)}` : '';
    return apiRequest<{
      students: Array<{
        assignmentId: string;
        id: string;
        firstName?: string;
        lastName?: string;
        name: string;
        email: string;
        assignedAt: string;
        assignedBy: any;
      }>;
      total: number;
    }>(`/admin/tutors/${tutorId}/students${qs}`);
  },

  // Platform analytics overview (admin only)
  getPlatformAnalyticsOverview: () => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        learners: {
          totalActive: number;
          totalWithAssignments: number;
        };
        drills: {
          totalAssignments: number;
          completed: number;
          inProgress: number;
          pending: number;
          overdue: number;
          averageScore: number;
          completionRatePct: number;
        };
      };
    }>('/admin/analytics/overview', {
      method: 'GET',
      cache: false,
    });
  },

  // Aggregated analytics dashboard (platform-wide or filtered learners)
  getAnalyticsDashboard: (params?: { learnerIds?: string[]; days?: number }) => {
    const query: Record<string, string | number> = {};
    if (params?.learnerIds && params.learnerIds.length > 0) {
      query.learnerIds = params.learnerIds.join(',');
    }
    if (params?.days != null) {
      query.days = params.days;
    }
    return apiRequest<{
      code?: string;
      message?: string;
      data?: import('@/types/admin-analytics-dashboard').AnalyticsDashboardData;
    }>('/admin/analytics/dashboard', {
      method: 'GET',
      params: query,
      cache: false,
    });
  },

  // Learners with analytics summaries (admin only)
  getAnalyticsLearners: (params?: {
    limit?: number;
    offset?: number;
    search?: string;
    signupDateFrom?: string;
    signupDateTo?: string;
    status?: 'active' | 'inactive';
  }) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        learners: Array<{
          _id: string;
          firstName?: string;
          lastName?: string;
          name?: string;
          email: string;
          isActive?: boolean;
          createdAt: string;
          summary: {
            drillCompletionRatePct: number;
            drillAverageScore: number;
            pronunciationAverageScore: number;
            overallProgressPct: number;
          };
        }>;
        pagination: {
          total: number;
          limit: number;
          offset: number;
          hasMore: boolean;
        };
      };
    }>('/admin/analytics/learners', {
      method: 'GET',
      params,
      cache: false,
    });
  },

  // Get all learners (admin only)
  getAllLearners: (params?: {
    limit?: number;
    offset?: number;
    search?: string;
    signupDateFrom?: string;
    signupDateTo?: string;
    status?: 'active' | 'inactive';
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
      cache: false,
    });
  },

  getDashboardStats: () => {
    return apiRequest<{
      code: string;
      message: string;
      data: {
        totalUsers: number;
        subscribedUsers: number;
        totalActiveLearners: number;
        totalDrills: number;
        zeroPauseChallengeUsers: number;
        zeroPauseMasteryUsers: number;
        newSignupsThisWeek: number;
        discoveryCallsToday: number;
        videosAwaitingReview: number;
      };
    }>('/admin/dashboard/stats', {
      method: 'GET',
      cache: false,
    });
  },

  // Update user subscription (admin only)
  updateUserSubscription: (data: {
    userId: string;
    plan: "free" | "premium";
    months?: number;
    billingPeriod?: "monthly" | "quarterly" | "annual";
    zeroPauseProducts?: ("challenge" | "mastery")[];
    zeroPauseDate?: string | null;
    amount?: number;
    paymentMethod?: string;
    note?: string;
  }) => {
    return apiRequest<{
      code: string;
      message: string;
      data: {
        userId: string;
        subscriptionPlan: "free" | "premium";
        subscriptionBillingPeriod: "monthly" | "quarterly" | "annual" | null;
        zeroPauseProducts: ("challenge" | "mastery")[];
        zeroPauseDate: string | null;
        subscriptionActivatedAt: string | null;
        subscriptionExpiresAt: string | null;
      };
    }>('/admin/users/subscription', {
      method: 'POST',
      data,
    }).then((response) => {
      // Subscription changes must be visible on the learners list immediately.
      apiCache.clearPattern('^/admin/learners');
      apiCache.clearPattern('^/users');
      return response;
    });
  },

  // Update a learner's name (admin only)
  updateLearnerName: (learnerId: string, data: { firstName: string; lastName: string }) => {
    return apiRequest<{
      code: string;
      data: { learner: { id: string; firstName: string; lastName: string; name: string } };
    }>(`/admin/learners/${learnerId}`, {
      method: 'PATCH',
      data,
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

  /** Grammar drill analytics for a learner (aggregated attempts). Admin/tutor. */
  getLearnerGrammarAnalytics: (
    learnerId: string,
    params?: { from?: string; to?: string }
  ) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        totalAssignedPatterns: number;
        correctSentence: number;
        incorrectSentence: number;
        problemRows: Array<{
          id: string;
          patternLabel: string;
          sentence: string;
          count: number;
        }>;
        feedbackRows: Array<{
          id: string;
          label: string;
          sentence: string;
          count: number;
        }>;
        hasReviewedData: boolean;
        attemptsConsidered: number;
      };
    }>(`/admin/learners/${learnerId}/grammar-analytics`, {
      method: 'GET',
      params,
      cache: false,
    });
  },

  /** Sentence-writing drill analytics for a learner (aggregated attempts). Admin/tutor. */
  getLearnerSentenceAnalytics: (
    learnerId: string,
    params?: { from?: string; to?: string }
  ) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        totalAssignedTargets: number;
        correctSentence: number;
        incorrectSentence: number;
        problemRows: Array<{
          id: string;
          areaLabel: string;
          sentence: string;
          count: number;
        }>;
        feedbackRows: Array<{
          id: string;
          label: string;
          sentence: string;
          count: number;
        }>;
        hasReviewedData: boolean;
        attemptsConsidered: number;
      };
    }>(`/admin/learners/${learnerId}/sentence-analytics`, {
      method: 'GET',
      params,
      cache: false,
    });
  },

  /** Fill-in-the-blank drill analytics for a learner. Admin/tutor. */
  getLearnerFillBlankAnalytics: (
    learnerId: string,
    params?: { from?: string; to?: string }
  ) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        totalAssigned: number;
        totalCompleted: number;
        completionRatePct: number;
        totalAssignedBlanks: number;
        correctBlanks: number;
        incorrectBlanks: number;
        accuracyRatePct: number;
        totalAttempts: number;
        averageScore: number;
        problemRows: Array<{
          id: string;
          sentence: string;
          selectedAnswer: string;
          correctAnswer: string;
          count: number;
        }>;
        attemptsConsidered: number;
      };
    }>(`/admin/learners/${learnerId}/fill-blank-analytics`, {
      method: 'GET',
      params,
      cache: false,
    });
  },

  /** Key phrase drill analytics for a learner. Admin/tutor. */
  getLearnerKeyPhrasesAnalytics: (
    learnerId: string,
    params?: { from?: string; to?: string }
  ) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        totalAssigned: number;
        totalCompleted: number;
        completionRatePct: number;
        totalAssignedItems: number;
        correctItems: number;
        incorrectItems: number;
        accuracyRatePct: number;
        totalAttempts: number;
        averageScore: number;
        averagePronunciationScore: number;
        problemRows: Array<{
          id: string;
          prompt: string;
          selectedAnswer: string;
          correctAnswer: string;
          count: number;
        }>;
        attemptsConsidered: number;
      };
    }>(`/admin/learners/${learnerId}/key-phrases-analytics`, {
      method: 'GET',
      params,
      cache: false,
    });
  },

  /** Platform fill-in-the-blank analytics (admin). */
  getPlatformFillBlankAnalytics: (params?: { days?: number; learnerIds?: string[] }) => {
    const query: Record<string, string | number> = {};
    if (params?.days != null) query.days = params.days;
    if (params?.learnerIds?.length) query.learnerIds = params.learnerIds.join(',');
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        stats: {
          totalAssigned: number;
          totalCompleted: number;
          completionRatePct: number;
          totalAssignedBlanks: number;
          correctBlanks: number;
          incorrectBlanks: number;
          accuracyRatePct: number;
          totalAttempts: number;
          averageScore: number;
        };
        problemRows: Array<{
          id: string;
          sentence: string;
          selectedAnswer: string;
          correctAnswer: string;
          count: number;
        }>;
      };
    }>('/admin/analytics/fill-blank', {
      method: 'GET',
      params: query,
      cache: false,
    });
  },

  /** Platform key phrase analytics (admin). */
  getPlatformKeyPhrasesAnalytics: (params?: { days?: number; learnerIds?: string[] }) => {
    const query: Record<string, string | number> = {};
    if (params?.days != null) query.days = params.days;
    if (params?.learnerIds?.length) query.learnerIds = params.learnerIds.join(',');
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        stats: {
          totalAssigned: number;
          totalCompleted: number;
          completionRatePct: number;
          totalAssignedItems: number;
          correctItems: number;
          incorrectItems: number;
          accuracyRatePct: number;
          totalAttempts: number;
          averageScore: number;
          averagePronunciationScore: number;
        };
        problemRows: Array<{
          id: string;
          prompt: string;
          selectedAnswer: string;
          correctAnswer: string;
          count: number;
        }>;
      };
    }>('/admin/analytics/key-phrases', {
      method: 'GET',
      params: query,
      cache: false,
    });
  },

  /** Matching drill analytics for a learner (aggregated attempts). Admin/tutor. */
  getLearnerMatchingAnalytics: (
    learnerId: string,
    params?: { from?: string; to?: string }
  ) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        totalAssignedPairs: number;
        totalAttempts: number;
        accuracyRatePct: number;
        confusions: Array<{
          id: string;
          left: string;
          attemptedMatch: string;
          correctRight: string;
          count: number;
        }>;
        fastMatches: number;
        slowMatches: number;
        slowestMatchSeconds: number | null;
        slowestMatchLabel: string | null;
        hasPairTimingData: boolean;
        timingAvailableSince: string | null;
        attemptsConsidered: number;
      };
    }>(`/admin/learners/${learnerId}/matching-analytics`, {
      method: 'GET',
      params,
      cache: false,
    });
  },

  /** Eklan Free Talk attempts for a learner (admin/tutor). */
  getLearnerFreeTalkAttempts: (
    learnerId: string,
    params?: { limit?: number; cursor?: string | null }
  ) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        attempts: Array<{
          id: string;
          scenarioId: string;
          scenarioTitle: string;
          scenarioType: string;
          feedbackText: string;
          gradeResult: unknown;
          audioUrl: string | null;
          audioMimeType: string | null;
          durationMs: number | null;
          usedVoice: boolean;
          completedAt: string;
        }>;
        nextCursor: string | null;
      };
    }>(`/admin/learners/${learnerId}/free-talk-attempts`, {
      method: 'GET',
      params,
      cache: false,
    });
  },

  // Get discovery calls (admin only)
  getDiscoveryCalls: (params?: {
    limit?: number;
    offset?: number;
  }) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: {
        calls: any[];
        total: number;
        limit: number;
        offset: number;
      };
    }>('/admin/discovery-calls', {
      method: 'GET',
      params,
    });
  },
};

// Classes (admin teaching sessions)
export const classesAPI = {
  list: (params?: {
    bucket?: import('@/domain/classes/class.api.types').ClassBucket;
    limit?: number;
    offset?: number;
  }) => {
    return apiRequest<{
      code: string;
      data: {
        classes: import('@/domain/classes/class.api.types').AdminClassListItemDTO[];
        pagination: {
          total: number;
          limit: number;
          offset: number;
          hasMore?: boolean;
        };
      };
    }>('/admin/classes', {
      method: 'GET',
      params,
      cache: false,
    });
  },

  create: (data: import('@/domain/classes/class.api.types').CreateAdminClassBody) => {
    return apiRequest<{
      code: string;
      data: {
        classSeriesId: string;
        sessionIds: string[];
        class: import('@/domain/classes/class.api.types').AdminClassListItemDTO;
        calendarSyncWarning?: string;
      };
    }>('/admin/classes', {
      method: 'POST',
      data,
    });
  },

  getById: (classSeriesId: string) => {
    return apiRequest<{
      code: string;
      data: import('@/domain/classes/class.api.types').AdminClassDetailDTO;
    }>(`/admin/classes/${classSeriesId}`, {
      method: 'GET',
      cache: false,
    });
  },

  delete: (classSeriesId: string) => {
    return apiRequest<{
      code: string;
      data: { deleted: boolean };
    }>(`/admin/classes/${classSeriesId}`, {
      method: 'DELETE',
    });
  },

  /** Admin: one session (reschedule page). */
  adminSession: (sessionId: string) => {
    return apiRequest<{
      code: string;
      data: {
        session: {
          id: string;
          classSeriesId: string;
          startUtc: string;
          endUtc: string;
          status: string;
          isReschedule?: boolean;
        };
        classTitle: string;
        tutorName: string;
      };
    }>(`/admin/sessions/${sessionId}`, {
      method: 'GET',
      cache: false,
    });
  },

  adminRescheduleOptions: (sessionId: string) => {
    return apiRequest<{
      code: string;
      data: {
        slots: { startUtc: string; endUtc: string }[];
        weekPolicy?: string;
      };
    }>(`/admin/sessions/${sessionId}/reschedule-options`, {
      method: 'GET',
      cache: false,
    });
  },

  adminReschedule: (
    sessionId: string,
    body: {
      newStartUtc: string;
      newEndUtc: string;
      reservationId: string;
      reservationToken: string;
    },
  ) => {
    return apiRequest<{
      code: string;
      data: { updated: boolean };
    }>(`/admin/sessions/${sessionId}/reschedule`, {
      method: 'POST',
      data: body,
    });
  },

  /** Admin: reschedule to any future time (cross-week, no slot reservation). */
  adminRescheduleDirect: (
    sessionId: string,
    body: { newStartUtc: string; newEndUtc: string },
  ) => {
    return apiRequest<{
      code: string;
      data: { updated: boolean };
    }>(`/admin/sessions/${sessionId}/reschedule-direct`, {
      method: 'POST',
      data: body,
    });
  },

  adminReserveRescheduleSlot: (
    sessionId: string,
    body: { startUtc: string; endUtc: string },
  ) => {
    return apiRequest<{
      code: string;
      data: { reservationId: string; token: string; expiresAt: string };
    }>(`/admin/sessions/${sessionId}/reserve-slot`, {
      method: 'POST',
      data: body,
    });
  },

  /** Tutor: session summary for assigned tutor (reschedule page). */
  tutorSession: (sessionId: string) => {
    return apiRequest<{
      code: string;
      data: {
        session: {
          id: string;
          classSeriesId: string;
          startUtc: string;
          endUtc: string;
          status: string;
          isReschedule?: boolean;
        };
        classTitle: string;
        tutorName: string;
      };
    }>(`/tutor/sessions/${sessionId}`, {
      method: 'GET',
      cache: false,
    });
  },

  tutorRescheduleOptions: (sessionId: string) => {
    return apiRequest<{
      code: string;
      data: {
        slots: { startUtc: string; endUtc: string }[];
        weekPolicy?: string;
      };
    }>(`/tutor/sessions/${sessionId}/reschedule-options`, {
      method: 'GET',
      cache: false,
    });
  },

  tutorReschedule: (
    sessionId: string,
    body: {
      newStartUtc: string;
      newEndUtc: string;
      reservationId: string;
      reservationToken: string;
    },
  ) => {
    return apiRequest<{
      code: string;
      data: { updated: boolean };
    }>(`/tutor/sessions/${sessionId}/reschedule`, {
      method: 'POST',
      data: body,
    });
  },

  tutorReserveRescheduleSlot: (
    sessionId: string,
    body: { startUtc: string; endUtc: string },
  ) => {
    return apiRequest<{
      code: string;
      data: { reservationId: string; token: string; expiresAt: string };
    }>(`/tutor/sessions/${sessionId}/reserve-slot`, {
      method: 'POST',
      data: body,
    });
  },

  /** Tutor-scoped list; meetingUrl only within join window (Phase 2). */
  tutorList: (params?: {
    bucket?: import('@/domain/classes/class.api.types').ClassBucket;
    limit?: number;
    offset?: number;
  }) => {
    return apiRequest<{
      code: string;
      data: {
        classes: import('@/domain/classes/class.api.types').AdminClassListItemDTO[];
        pagination: {
          total: number;
          limit: number;
          offset: number;
          hasMore?: boolean;
        };
      };
    }>('/tutor/teaching-classes', {
      method: 'GET',
      params,
      cache: false,
    });
  },

  /** Learner: enrolled classes (Phase 3). */
  learnerList: (params?: {
    bucket?: import('@/domain/classes/class.api.types').ClassBucket;
    limit?: number;
    offset?: number;
  }) => {
    return apiRequest<{
      code: string;
      data: {
        classes: import('@/domain/classes/class.api.types').AdminClassListItemDTO[];
        pagination: {
          total: number;
          limit: number;
          offset: number;
          hasMore?: boolean;
        };
      };
    }>('/learner/classes', {
      method: 'GET',
      params,
      cache: false,
    });
  },

  /** Learner: ended class sessions (Past tab), newest first. */
  learnerPastSessions: (params?: { limit?: number; offset?: number }) => {
    return apiRequest<{
      code: string;
      data: {
        sessions: import('@/domain/classes/class.api.types').LearnerPastSessionItemDTO[];
        pagination: {
          total: number;
          limit: number;
          offset: number;
          hasMore?: boolean;
        };
      };
    }>('/learner/sessions/past', {
      method: 'GET',
      params,
      cache: false,
    });
  },

  learnerSession: (sessionId: string) => {
    return apiRequest<{
      code: string;
      data: {
        session: {
          id: string;
          classSeriesId: string;
          startUtc: string;
          endUtc: string;
          status: string;
          isReschedule?: boolean;
          meetingUrl?: string;
        };
        classTitle: string;
        tutorName: string;
        tutorId: string;
      };
    }>(`/learner/sessions/${sessionId}`, {
      method: 'GET',
      cache: false,
    });
  },

  /** Learner: record attendance after joining (Phase 4). */
  recordLearnerAttendance: (
    sessionId: string,
    data?: { status?: 'present' | 'late' },
  ) => {
    return apiRequest<{
      code: string;
      data: { recorded: boolean; status: string };
    }>(`/learner/sessions/${sessionId}/attendance`, {
      method: 'POST',
      data: data ?? {},
    });
  },

  /** Tutor: attendance roster for a session (Phase 4). */
  getTutorSessionAttendance: (sessionId: string) => {
    return apiRequest<{
      code: string;
      data: {
        sessionId: string;
        attendance: import('@/domain/classes/class.api.types').SessionAttendanceItemDTO[];
      };
    }>(`/tutor/sessions/${sessionId}/attendance`, {
      method: 'GET',
      cache: false,
    });
  },

  /** Tutor: weekly availability (timezone, rules, exceptions, buffer). */
  getTutorAvailability: () => {
    return apiRequest<{
      code: string;
      data: import('@/domain/tutor-availability/tutor-availability.api.types').TutorAvailabilityResponse;
    }>('/tutor/availability', {
      method: 'GET',
      cache: false,
    });
  },

  updateTutorAvailability: (
    body: import('@/domain/tutor-availability/tutor-availability.api.types').TutorAvailabilityResponse,
  ) => {
    return apiRequest<{
      code: string;
      data: import('@/domain/tutor-availability/tutor-availability.api.types').TutorAvailabilityResponse;
    }>('/tutor/availability', {
      method: 'PATCH',
      data: body,
    });
  },

  /** Learner: read tutor availability when enrolled with that tutor. */
  getLearnerTutorAvailability: (tutorId: string) => {
    return apiRequest<{
      code: string;
      data: import('@/domain/tutor-availability/tutor-availability.api.types').TutorAvailabilityResponse;
    }>(`/learner/tutors/${tutorId}/availability`, {
      method: 'GET',
      cache: false,
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

// Weekly Challenge API
export const weeklyChallengeAPI = {
	getHistory: () => {
		return apiRequest<{
			code?: string;
			data?: {
				challenges: Array<{
					challengeId: string | null;
					weekStartDate: string;
					weekNumber?: number;
					status: 'ready' | 'generating' | 'failed' | 'unavailable';
					summaryMessage: string;
					totalEstimatedMinutes: number;
					drillSequence: Array<{
						index: number;
						itemId: string;
						drillType: string;
						label: string;
						instructions: string;
						estimatedMinutes: number;
						completed: boolean;
					}>;
					isSunday: boolean;
				}>;
			};
		}>('/learner/weekly-challenge/history', {
			method: 'GET',
			cache: false,
		});
	},

	getCurrent: (weekStartDate?: string) => {
		return apiRequest<{
			code?: string;
			data?: {
				challengeId: string | null;
				weekStartDate: string;
				weekNumber?: number;
				status: 'ready' | 'generating' | 'failed' | 'unavailable';
				summaryMessage: string;
				totalEstimatedMinutes: number;
				drillSequence: Array<{
					index: number;
					itemId: string;
					drillType: string;
					label: string;
					instructions: string;
					estimatedMinutes: number;
					completed: boolean;
				}>;
				isSunday: boolean;
			};
		}>('/learner/weekly-challenge', {
			method: 'GET',
			params: weekStartDate ? { weekStartDate } : undefined,
			cache: false,
		});
	},

	getItem: (itemId: string | number, weekStartDate?: string) => {
		return apiRequest<{
			code?: string;
			data?: {
				challengeId: string;
				itemId: string;
				weekStartDate: string;
				index: number;
				item: Record<string, unknown>;
				completed: boolean;
			};
		}>(`/learner/weekly-challenge/items/${itemId}`, {
			method: 'GET',
			params: weekStartDate ? { weekStartDate } : undefined,
			cache: false,
		});
	},

	completeItem: (
		itemId: string | number,
		data?: { score?: number },
		weekStartDate?: string,
	) => {
		return apiRequest<{
			code?: string;
			data?: {
				challengeId: string;
				itemId: string;
				index: number;
				completed: boolean;
				completedItemIndexes: number[];
				totalItems: number;
			};
		}>(`/learner/weekly-challenge/items/${itemId}/complete`, {
			method: 'POST',
			data,
			params: weekStartDate ? { weekStartDate } : undefined,
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
  recordActivity: () => {
    return apiRequest<{ code?: string; data?: { recorded: boolean } }>(
      '/users/streak/activity',
      {
        method: 'POST',
      }
    );
  },
};

