import { userAPI } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

/**
 * Profile service for managing user profile
 */
export const profileService = {
  /**
   * Get current user profile
   */
  async getProfile() {
    const response = await userAPI.getCurrent();
    return response.user;
  },

  /**
   * Update user profile
   */
  async updateProfile(data: {
    firstName?: string;
    lastName?: string;
    username?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
  }) {
    const response = await userAPI.update(data);
    
    // Update auth store with new user data
    const authStore = useAuthStore.getState();
    if (response.data?.user) {
      authStore.setUser(response.data.user);
    }
    
    return response.data.user;
  },

  /**
   * Upload avatar image
   */
  async uploadAvatar(file: File) {
    // Validate file
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image size must be less than 5MB');
    }

    const response = await userAPI.uploadAvatar(file);
    
    // Update auth store with new avatar
    const authStore = useAuthStore.getState();
    if (authStore.user) {
      authStore.setUser({
        ...authStore.user,
        avatar: response.data.avatarUrl,
      });
    }
    
    return response.data;
  },

  /**
   * Delete user account
   */
  async deleteAccount() {
    await userAPI.delete();
    
    // Clear auth store
    const authStore = useAuthStore.getState();
    authStore.logout();
  },
};

