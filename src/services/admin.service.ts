import { adminAPI, apiRequest } from "@/lib/api";

// Admin API Service
export const adminService = {
  // Get all learners
  getLearners: async (params?: {
    limit?: number;
    offset?: number;
    search?: string;
  }) => {
    const response = await adminAPI.getAllLearners({
      limit: params?.limit,
      offset: params?.offset,
      search: params?.search,
    });
    return response;
  },

  // Get discovery calls
  getDiscoveryCalls: async (params?: {
    limit?: number;
    offset?: number;
  }) => {
    return adminAPI.getDiscoveryCalls(params);
  },

  // Get learner by ID
  getLearnerById: async (learnerId: string) => {
    return adminAPI.getUserById(learnerId);
  },

  // Get all drills
  getDrills: async (params?: {
    limit?: number;
    offset?: number;
    type?: string;
    difficulty?: string;
    isActive?: boolean;
  }) => {
    const { drillAPI } = await import('@/lib/api');
    const response = await drillAPI.getAll(params);
    // Handle different response structures
    if (response.data?.drills) {
      return {
        drills: response.data.drills || [],
        total: response.data.pagination?.total || 0,
        limit: response.data.pagination?.limit || params?.limit || 20,
        offset: response.data.pagination?.offset || params?.offset || 0,
      };
    } else if (response.drills) {
      return {
        drills: response.drills || [],
        total: response.total || 0,
        limit: response.limit || params?.limit || 20,
        offset: response.offset || params?.offset || 0,
      };
    }
    return {
      drills: [],
      total: 0,
      limit: params?.limit || 20,
      offset: params?.offset || 0,
    };
  },

  // Get drill assignments for a specific drill
  getDrillAssignments: async (drillId: string, params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    return apiRequest<{
      code: string;
      message: string;
      data: {
        assignments: Array<{
          _id: string;
          drillId: any;
          learnerId: {
            _id: string;
            firstName?: string;
            lastName?: string;
            email: string;
            avatar?: string;
          };
          assignedBy: {
            _id: string;
            firstName?: string;
            lastName?: string;
            email: string;
          };
          assignedAt: string;
          dueDate?: string;
          status: string;
          completedAt?: string;
        }>;
        totalAssignments: number;
        limit: number;
        offset: number;
      };
    }>(`/drills/${drillId}/assignments?${queryParams.toString()}`);
  },

  // Assign drill to learners
  assignDrill: async (drillId: string, data: {
    learnerIds: string[];
    dueDate?: string;
  }) => {
    return apiRequest<{
      code: string;
      message: string;
      data: { assignments: any[] };
    }>(`/drills/${drillId}/assign`, {
      method: "POST",
      data,
    });
  },

  // Get dashboard stats (we'll need to create this endpoint or calculate from existing data)
  getDashboardStats: async (): Promise<{
    totalUsers: number;
    subscribedUsers: number;
    totalActiveLearners: number;
    totalDrills: number;
    zeroPauseChallengeUsers: number;
    zeroPauseMasteryUsers: number;
    newSignupsThisWeek: number;
    discoveryCallsToday: number;
    videosAwaitingReview: number;
  }> => {
    // For now, we'll fetch data and calculate stats on the frontend
    const [usersResponse, drills] = await Promise.all([
      adminAPI.getAllLearners({ limit: 1000 }),
      adminService.getDrills({ limit: 1 }),
    ]);

    const users = usersResponse.data?.learners || [];
    const now = new Date();

    const totalUsers = users.length;
    const subscribedUsers = users.filter((u: any) => {
      if (u.subscriptionPlan !== "premium") return false;
      if (!u.subscriptionExpiresAt) return false;
      const expiry = new Date(u.subscriptionExpiresAt);
      return expiry.getTime() > now.getTime();
    }).length;

    const activeCount = users.filter((u: any) => u.isActive !== false).length;

    const zeroPauseChallengeUsers = users.filter(
      (u: any) =>
        Array.isArray(u.zeroPauseProducts) &&
        u.zeroPauseProducts.includes("challenge"),
    ).length;

    const zeroPauseMasteryUsers = users.filter(
      (u: any) =>
        Array.isArray(u.zeroPauseProducts) &&
        u.zeroPauseProducts.includes("mastery"),
    ).length;

    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const newSignupsThisWeek = users.filter(
      (u: any) => u.createdAt && new Date(u.createdAt) >= oneWeekAgo
    ).length;

    return {
      totalUsers,
      subscribedUsers,
      totalActiveLearners: activeCount,
      totalDrills: drills.total,
      zeroPauseChallengeUsers,
      zeroPauseMasteryUsers,
      newSignupsThisWeek,
      discoveryCallsToday: 0,
      videosAwaitingReview: 0,
    };
  },


  // Assign role to a user
  assignRole: async (userId: string, role: 'user' | 'tutor' | 'admin', profileData?: any) => {
    return adminAPI.assignRole(userId, role, profileData);
  },
};

