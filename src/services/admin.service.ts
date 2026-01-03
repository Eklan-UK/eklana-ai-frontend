import { adminAPI, apiRequest } from "@/lib/api";

// Admin API Service
export const adminService = {
  // Get all learners
  getLearners: async (params?: {
    limit?: number;
    offset?: number;
    role?: string;
    search?: string;
  }) => {
    const response = await adminAPI.getAllUsers({
      limit: params?.limit,
      offset: params?.offset,
      role: params?.role || 'learner',
      search: params?.search,
    });
    
    return response;
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
  getDashboardStats: async () => {
    // For now, we'll fetch data and calculate stats on the frontend
    // In the future, we can create a dedicated endpoint
    const [learners, drills] = await Promise.all([
      adminService.getLearners({ limit: 1 }),
      adminService.getDrills({ limit: 1 }),
    ]);

    // Get active learners count
    const activeLearners = await adminService.getLearners({ limit: 1000 });
    const activeCount = activeLearners.users.filter(u => u.isActive !== false).length;

    return {
      totalActiveLearners: activeCount,
      totalDrills: drills.total,
      // Add more stats as needed
    };
  },

  // Get learners with their drill counts
  getLearnersWithDrillCounts: async () => {
    const learners = await adminService.getLearners({ limit: 1000, role: 'learner' });
    
    // For each learner, get their drill assignments count
    // This is a simplified version - in production, you'd want a dedicated endpoint
    const learnersWithCounts = await Promise.all(
      learners.users.map(async (learner) => {
        try {
          const assignments = await apiRequest<{
            code: string;
            message: string;
            data: {
              assignments: any[];
              totalAssignments: number;
            };
          }>(`/drills/learner/${learner._id}?limit=1`);
          return {
            ...learner,
            drillCount: assignments.data?.totalAssignments || 0,
            lastPractice: null, // TODO: Get from learning sessions or drill attempts
          };
        } catch {
          return {
            ...learner,
            drillCount: 0,
            lastPractice: null,
          };
        }
      })
    );

    return learnersWithCounts;
  },

  // Assign role to a user
  assignRole: async (userId: string, role: 'learner' | 'tutor' | 'admin', profileData?: any) => {
    return adminAPI.assignRole(userId, role, profileData);
  },
};

