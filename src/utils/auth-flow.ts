// Utility functions for authentication flow
import { useAuthStore } from '@/store/auth-store';

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
    // For users, check hasProfile from user object (no API call needed!)
    // hasProfile is now part of the user object returned from Better Auth
    hasOnboarding = user?.hasProfile === true;
    shouldOnboard = !hasOnboarding;
    
    // Update auth store cache for consistency
    const authState = useAuthStore.getState();
    if (authState.hasProfile !== hasOnboarding) {
      authState.setHasProfile(hasOnboarding);
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
  
  // Check hasProfile from user object first (most reliable)
  if (authState.user?.hasProfile === true) {
    return true;
  }
  
  // Fallback to cached value from store
  if (authState.hasProfile === true) {
    return true;
  }
  
  // If explicitly false, return false
  if (authState.hasProfile === false || authState.user?.hasProfile === false) {
    return false;
  }
  
  // No data available
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
