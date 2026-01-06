// Utility functions for authentication flow
import { userAPI } from '@/lib/api';

export interface AuthFlowStatus {
  isVerified: boolean;
  hasOnboarding: boolean;
  shouldVerify: boolean;
  shouldOnboard: boolean;
}

/**
 * Check user's verification and onboarding status
 */
export async function checkAuthFlowStatus(user: any): Promise<AuthFlowStatus> {
  // Check email verification status
  // Better Auth uses emailVerified field
  const isVerified = user?.emailVerified === true || user?.isEmailVerified === true;
  
  // For OAuth users (Google/Apple), they're typically auto-verified
  // Check if user has social accounts linked
  const isOAuthUser = user?.accounts && Array.isArray(user.accounts) && user.accounts.length > 0;
  const shouldVerify = !isVerified && !isOAuthUser;
  
  // Check onboarding status by checking if Profile exists
  // Profile is created during onboarding completion
  let hasOnboarding = false;
  let shouldOnboard = false;
  
  // Normalize role (handle legacy "learner" role)
  const userRole = user?.role === 'learner' ? 'user' : user?.role;

  // Admins and tutors don't need profiles/onboarding
  if (userRole === 'admin' || userRole === 'tutor') {
    hasOnboarding = true;
    shouldOnboard = false;
  } else if (userRole === 'user' || !userRole) {
    // For users (or users without role set), check if Profile exists via API
    try {
      const response = await userAPI.checkProfile();
      hasOnboarding = response.hasProfile || false;
      shouldOnboard = !hasOnboarding;
    } catch (error: any) {
      // On error, check if it's a 403 Forbidden (might be role issue)
      if (error?.message?.includes('Forbidden') || error?.code === 'Forbidden') {
        // If forbidden, user might not have proper role set - assume needs onboarding
        console.warn('Forbidden error checking profile, assuming onboarding needed:', error);
        hasOnboarding = false;
        shouldOnboard = true;
      } else {
        // On other errors, assume no onboarding
        console.error('Error checking profile:', error);
        hasOnboarding = false;
        shouldOnboard = true;
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

