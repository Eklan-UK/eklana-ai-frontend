import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { authClient } from "@/lib/auth-client";

interface AuthState {
  user: any | null;
  session: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  lastSessionCheck: number | null;
  hasProfile: boolean | null; // Cache profile check
  profileCheckedAt: number | null; // When profile was checked
  // Actions
  setUser: (user: any | null) => void;
  setSession: (session: any | null) => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  setHasProfile: (hasProfile: boolean) => void;
  login: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: (forceRefresh?: boolean) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
}

// Session check throttle: only check once per 2 hours unless forced
const SESSION_CHECK_THROTTLE = 2 * 60 * 60 * 1000; // 2 hours

// Profile check throttle: cache for 24 hours
const PROFILE_CHECK_THROTTLE = 24 * 60 * 60 * 1000; // 24 hours

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isLoading: true,
      isAuthenticated: false,
      hasHydrated: false,
      lastSessionCheck: null,
      hasProfile: null,
      profileCheckedAt: null,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setSession: (session) =>
        set({
          session,
          user: session?.user || null,
          isAuthenticated: !!session?.user,
        }),

      setLoading: (loading) => set({ isLoading: loading }),

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      setHasProfile: (hasProfile) =>
        set({
          hasProfile,
          profileCheckedAt: Date.now(),
        }),

      login: async (
        email: string,
        password: string,
        rememberMe: boolean = false
      ) => {
        try {
          set({ isLoading: true });

          const result = await authClient.signIn.email({
            email,
            password,
            rememberMe,
          });

          if (result.data?.user) {
            set({
              user: result.data.user,
              session: result.data,
              isAuthenticated: true,
              isLoading: false,
              lastSessionCheck: Date.now(),
            });
            return;
          }

          if (result.error) {
            set({ isLoading: false });
            throw new Error(result.error.message || "Login failed");
          }

          set({ isLoading: false });
          throw new Error("Login failed - no response data");
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (data) => {
        try {
          set({ isLoading: true });

          const result = await authClient.signUp.email({
            email: data.email,
            password: data.password,
            name: data.name,
            ...(data.firstName && { firstName: data.firstName }),
            ...(data.lastName && { lastName: data.lastName }),
          });

          if (result.data?.user) {
            set({
              user: result.data.user,
              session: result.data,
              isAuthenticated: true,
              isLoading: false,
              lastSessionCheck: Date.now(),
              // New users need onboarding
              hasProfile: false,
              profileCheckedAt: Date.now(),
            });
            return;
          }

          if (result.error) {
            set({ isLoading: false });
            throw new Error(result.error.message || "Registration failed");
          }

          set({ isLoading: false });
          throw new Error("Registration failed - no response data");
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          // Clear local state immediately - THIS IS THE ONLY PLACE STATE IS CLEARED
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            isLoading: false,
            lastSessionCheck: null,
            hasProfile: null,
            profileCheckedAt: null,
          });

          // Clear any cached activities
          if (typeof window !== "undefined") {
            localStorage.removeItem("activities-cache");
          }

          // Then call server logout (errors ignored - local state is cleared)
          await authClient.signOut();
        } catch (error) {
          // State already cleared, logout is "successful" locally
          console.error("Logout error:", error);
        }
      },

      checkSession: async (forceRefresh = false) => {
        const state = get();

        // ALWAYS use cached session if available
        // Only clear session on explicit logout
        if (state.user && state.session && state.isAuthenticated) {
          set({ isLoading: false });

          // Check throttle for background refresh
          if (!forceRefresh && state.lastSessionCheck !== null) {
            const timeSinceLastCheck = Date.now() - state.lastSessionCheck;
            if (timeSinceLastCheck < SESSION_CHECK_THROTTLE) {
              return; // Skip background check - checked recently
            }
          }

          // Background refresh (non-blocking) - NEVER clears state on error
          authClient
            .getSession()
            .then((sessionResult) => {
              if (sessionResult?.data?.user) {
                // Update with fresh data silently
                set({
                  user: sessionResult.data.user,
                  session: sessionResult.data,
                  isAuthenticated: true,
                  lastSessionCheck: Date.now(),
                });
              }
              // On any error or null response - DO NOT clear session
              // User explicitly logged in, keep them logged in
            })
            .catch((error) => {
              // Network error - keep cached session
              console.warn("Background session check failed:", error);
            });

          return;
        }

        // No cached session - need to check server
        try {
          set({ isLoading: true });

          const sessionResult = await authClient.getSession();

          if (sessionResult?.data?.user) {
            set({
              user: sessionResult.data.user,
              session: sessionResult.data,
              isAuthenticated: true,
              isLoading: false,
              lastSessionCheck: Date.now(),
            });
          } else {
            // No session from server AND no cached session
            set({
              session: null,
              user: null,
              isAuthenticated: false,
              isLoading: false,
              lastSessionCheck: null,
            });
          }
        } catch (error) {
          console.warn("Session check failed:", error);
          // No cached session and error - can't authenticate
          set({
            session: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            lastSessionCheck: null,
          });
        }
      },

      signInWithGoogle: async () => {
        try {
          set({ isLoading: true });

          await authClient.signIn.social({
            provider: "google",
            callbackURL: `${window.location.origin}/auth/callback`,
          });
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      signInWithApple: async () => {
        try {
          set({ isLoading: true });

          await authClient.signIn.social({
            provider: "apple",
            callbackURL: `${window.location.origin}/auth/callback`,
          });
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
        lastSessionCheck: state.lastSessionCheck,
        hasProfile: state.hasProfile,
        profileCheckedAt: state.profileCheckedAt,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);

          // If we have persisted session, use it - NEVER check session on load
          if (state.user && state.session && state.isAuthenticated) {
            state.setLoading(false);
            // Trust the cached session completely
          } else {
            state.setLoading(true);
          }
        }
      },
    }
  )
);

// Helper to check if profile check is still valid
export function isProfileCheckValid(): boolean {
  const state = useAuthStore.getState();
  if (state.hasProfile === null || state.profileCheckedAt === null) {
    return false;
  }
  const timeSinceCheck = Date.now() - state.profileCheckedAt;
  return timeSinceCheck < PROFILE_CHECK_THROTTLE;
}
