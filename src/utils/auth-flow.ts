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
  
  // Check onboarding status (only for learners)
  let hasOnboarding = false;
  let shouldOnboard = false;
  
  if (user?.role === 'learner') {
    try {
      const response = await userAPI.checkLearnerProfile();
      hasOnboarding = response.hasProfile || false;
      shouldOnboard = !hasOnboarding;
    } catch (error) {
      // On error, assume no onboarding
      hasOnboarding = false;
      shouldOnboard = true;
    }
  } else {
    // Admins and tutors don't need onboarding
    hasOnboarding = true;
    shouldOnboard = false;
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

