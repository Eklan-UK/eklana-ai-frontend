// Activity caching utility
// Caches user activities locally to reduce API calls and improve load times

const CACHE_KEY = 'activities-cache';
const MAX_ACTIVITIES = 50;

interface CachedActivity {
  type: string;
  resourceId: string;
  action: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

interface ActivityCache {
  activities: CachedActivity[];
  lastSynced: number | null;
  pendingSync: CachedActivity[];
}

function getCache(): ActivityCache {
  if (typeof window === 'undefined') {
    return { activities: [], lastSynced: null, pendingSync: [] };
  }
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.warn('Failed to read activity cache:', error);
  }
  
  return { activities: [], lastSynced: null, pendingSync: [] };
}

function saveCache(cache: ActivityCache) {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Failed to save activity cache:', error);
  }
}

/**
 * Track an activity locally (no API call)
 * Activities are stored in localStorage for fast access
 */
export function trackActivity(
  type: string,
  resourceId: string,
  action: string,
  metadata?: Record<string, any>
) {
  const cache = getCache();
  
  const newActivity: CachedActivity = {
    type,
    resourceId,
    action,
    metadata,
    timestamp: Date.now(),
  };
  
  // Add to activities (most recent first)
  cache.activities.unshift(newActivity);
  
  // Add to pending sync queue
  cache.pendingSync.push(newActivity);
  
  // Trim to max size
  if (cache.activities.length > MAX_ACTIVITIES) {
    cache.activities = cache.activities.slice(0, MAX_ACTIVITIES);
  }
  
  // Keep pending sync queue manageable
  if (cache.pendingSync.length > MAX_ACTIVITIES) {
    cache.pendingSync = cache.pendingSync.slice(-MAX_ACTIVITIES);
  }
  
  saveCache(cache);
}

/**
 * Get recent activities from cache
 */
export function getRecentActivities(limit: number = 10): CachedActivity[] {
  const cache = getCache();
  return cache.activities.slice(0, limit);
}

/**
 * Get activities for a specific resource
 */
export function getActivitiesForResource(resourceId: string): CachedActivity[] {
  const cache = getCache();
  return cache.activities.filter(a => a.resourceId === resourceId);
}

/**
 * Check if an activity was recently recorded
 */
export function hasRecentActivity(
  resourceId: string,
  action: string,
  withinMs: number = 60000 // 1 minute default
): boolean {
  const cache = getCache();
  const now = Date.now();
  
  return cache.activities.some(
    a => a.resourceId === resourceId && 
         a.action === action && 
         (now - a.timestamp) < withinMs
  );
}

/**
 * Sync pending activities to server in background
 * Called periodically or when online
 */
export async function syncActivitiesToServer() {
  const cache = getCache();
  
  if (cache.pendingSync.length === 0) {
    return;
  }
  
  try {
    // Batch sync all pending activities
    const response = await fetch('/api/v1/activities/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ activities: cache.pendingSync }),
    });
    
    if (response.ok) {
      // Clear pending sync on success
      cache.pendingSync = [];
      cache.lastSynced = Date.now();
      saveCache(cache);
    }
  } catch (error) {
    // Silently fail - activities will be synced later
    console.warn('Failed to sync activities:', error);
  }
}

/**
 * Clear all cached activities
 */
export function clearActivityCache() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CACHE_KEY);
}

// Auto-sync when online (if there are pending activities)
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // Debounce sync by 2 seconds after coming online
    setTimeout(() => {
      syncActivitiesToServer();
    }, 2000);
  });
  
  // Also sync periodically when page is visible (every 5 minutes)
  let lastAutoSync = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      if (now - lastAutoSync > 5 * 60 * 1000) {
        lastAutoSync = now;
        syncActivitiesToServer();
      }
    }
  });
}

