/**
 * Utility functions for user data
 */

/**
 * Get user's initials for avatar display
 */
export function getUserInitials(user: { name?: string; firstName?: string; lastName?: string; email?: string } | null): string {
  if (!user) return "U";

  // Try to get initials from name
  if (user.name) {
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }

  // Try to get initials from firstName and lastName
  if (user.firstName && user.lastName) {
    return (user.firstName[0] + user.lastName[0]).toUpperCase();
  }
  if (user.firstName) {
    return user.firstName[0].toUpperCase();
  }

  // Fallback to email
  if (user.email) {
    return user.email[0].toUpperCase();
  }

  return "U";
}

/**
 * Get user's display name
 */
export function getUserDisplayName(user: { name?: string; firstName?: string; lastName?: string; email?: string } | null): string {
  if (!user) return "User";

  if (user.name) return user.name;
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
  if (user.firstName) return user.firstName;
  if (user.email) return user.email.split("@")[0];
  
  return "User";
}

/**
 * Get user's first name for greetings
 */
export function getUserFirstName(user: { name?: string; firstName?: string; email?: string } | null): string {
  if (!user) return "there";

  if (user.firstName) return user.firstName;
  if (user.name) return user.name.split(" ")[0];
  if (user.email) return user.email.split("@")[0];
  
  return "there";
}

