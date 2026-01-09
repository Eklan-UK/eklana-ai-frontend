// Utility functions for authentication flow
import { userAPI } from '@/lib/api';
import { useAuthStore, isProfileCheckValid } from '@/store/auth-store';

export interface AuthFlowStatus {
  isVerified: boolean;
  hasOnboarding: boolean;
  shouldVerify: boolean;
  shouldOnboard: boolean;
}

// Profile check cache TTL: 24 hours
const PROFILE_CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Check user's verification and onboarding status
 * Uses cached profile check from auth store when available
 */
export async function checkAuthFlowStatus(user: any): Promise<AuthFlowStatus> {
  // Check email verification status
  const isVerified = user?.emailVerified === true || user?.isEmailVerified === true;
  
  // For OAuth users (Google/Apple), they're typically auto-verified
  const isOAuthUser = user?.accounts && Array.isArray(user.accounts) && user.accounts.length > 0;
  const shouldVerify = !isVerified && !isOAuthUser;
  
  // Check onboarding status
  let hasOnboarding = false;
  let shouldOnboard = false;
  
  // Normalize role (handle legacy "learner" role)
  const userRole = user?.role === 'learner' ? 'user' : user?.role;

  // Admins and tutors don't need profiles/onboarding
  if (userRole === 'admin' || userRole === 'tutor') {
    hasOnboarding = true;
    shouldOnboard = false;
  } else if (userRole === 'user' || !userRole) {
    // For users, check cached profile status first
    const authState = useAuthStore.getState();
    
    // Use cached profile check if valid
    if (isProfileCheckValid() && authState.hasProfile !== null) {
      hasOnboarding = authState.hasProfile;
      shouldOnboard = !hasOnboarding;
    } else {
      // Need to check via API
    try {
      const response = await userAPI.checkProfile();
      hasOnboarding = response.hasProfile || false;
      shouldOnboard = !hasOnboarding;
        
        // Cache the result in auth store
        authState.setHasProfile(hasOnboarding);
    } catch (error: any) {
        // On error, check if we have cached value
        if (authState.hasProfile !== null) {
          // Use cached value even if expired
          hasOnboarding = authState.hasProfile;
          shouldOnboard = !hasOnboarding;
        } else if (error?.message?.includes('Forbidden') || error?.code === 'Forbidden') {
          // If forbidden, assume needs onboarding
        hasOnboarding = false;
        shouldOnboard = true;
      } else {
        // On other errors, assume no onboarding
        console.error('Error checking profile:', error);
        hasOnboarding = false;
        shouldOnboard = true;
        }
      }
    }
  } else {
    // Unknown role - assume needs onboarding
    hasOnboarding = false;
    shouldOnboard = true;
  }
  
  return {
    isVerified: isVerified || isOAuthUser,
    hasOnboarding,
    shouldVerify,
    shouldOnboard,
  };
}

/**
 * Quick sync check for hasProfile using only cached data
 * Returns null if no cached data available
 */
export function getCachedProfileStatus(): boolean | null {
  const authState = useAuthStore.getState();
  
  // Admins and tutors always have profile
  const userRole = authState.user?.role === 'learner' ? 'user' : authState.user?.role;
  if (userRole === 'admin' || userRole === 'tutor') {
    return true;
  }
  
  // Return cached value if valid
  if (isProfileCheckValid()) {
    return authState.hasProfile;
  }
  
  // Return cached value even if expired (better than null)
  if (authState.hasProfile !== null) {
    return authState.hasProfile;
  }
  
  return null;
}

/**
 * Mark profile as completed (call after onboarding)
 */
export function markProfileComplete() {
  useAuthStore.getState().setHasProfile(true);
}

/**
 * Get the redirect path based on auth flow status
 */
export function getAuthRedirectPath(status: AuthFlowStatus): string {
  if (status.shouldVerify) {
    return '/auth/verify-email';
  }
  
  if (status.shouldOnboard) {
    return '/account/onboarding';
  }
  
  // All checks passed, go to home
  return '/account';
}
