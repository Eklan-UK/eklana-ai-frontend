import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { authClient } from "@/lib/auth-client";

interface AuthState {
  user: any | null;
  session: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  lastSessionCheck: number | null; // Track when we last checked session
  // Actions
  setUser: (user: any | null) => void;
  setSession: (session: any | null) => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
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

// Session check throttle: only check once per 30 minutes unless forced
const SESSION_CHECK_THROTTLE = 30 * 60 * 1000; // 30 minutes

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isLoading: true,
      isAuthenticated: false,
      hasHydrated: false,
      lastSessionCheck: null,

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

      login: async (
        email: string,
        password: string,
        rememberMe: boolean = false
      ) => {
        try {
          set({ isLoading: true });

          // Pass rememberMe option to Better Auth
          // When true, session will use the configured expiresIn (30 days)
          // When false, session will use default browser session duration
          const result = await authClient.signIn.email({
            email,
            password,
            rememberMe,
          });

          // Handle successful login
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

          // Handle errors
          if (result.error) {
            set({ isLoading: false });
            throw new Error(result.error.message || "Login failed");
          }

          // Unexpected case - no data and no error
          set({ isLoading: false });
          throw new Error("Login failed - no response data");
        } catch (error: any) {
          set({ isLoading: false });
          // Re-throw to let UI handle the error
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
          // Clear local state immediately for better UX
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            isLoading: false,
            lastSessionCheck: null,
          });

          // Then call server logout
          await authClient.signOut();
        } catch (error) {
          // State already cleared, so logout is "successful" locally
          console.error("Logout error:", error);
        }
      },

      checkSession: async (forceRefresh = false) => {
        const state = get();

        // If we have a valid cached session and not forcing refresh, check throttle
        if (
          !forceRefresh &&
          state.user &&
          state.session &&
          state.isAuthenticated &&
          state.lastSessionCheck !== null
        ) {
          const timeSinceLastCheck = Date.now() - state.lastSessionCheck;

          // If we checked recently (within throttle period), skip the check
          if (timeSinceLastCheck < SESSION_CHECK_THROTTLE) {
            set({ isLoading: false });
            return;
          }
        }

        // Use cached session if available and not forcing refresh
        if (
          !forceRefresh &&
          state.user &&
          state.session &&
          state.isAuthenticated
        ) {
          set({ isLoading: false });

          // Verify session in background without blocking UI
          authClient
            .getSession()
            .then((sessionResult) => {
              if (sessionResult?.data?.user) {
                // Update with fresh data
                set({
                  user: sessionResult.data.user,
                  session: sessionResult.data,
                  isAuthenticated: true,
                  lastSessionCheck: Date.now(),
                });
              } else if (sessionResult?.error) {
                // Network error or server error - keep cached session
                console.warn("Background session check error:", sessionResult.error);
                // Don't clear session on errors - user might be offline
              }
              // sessionResult.data === null means explicit logout/invalid session
              // But only clear if we explicitly got a "session not found" response
              // NOT on network errors
            })
            .catch((error) => {
              console.warn("Background session check failed:", error);
              // Keep cached session on network error - user might be offline
            });

          return;
        }

        // No cached session or forcing refresh
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
          } else if (sessionResult?.error) {
            // API returned an error (network issue, server error, etc.)
            console.warn("Session check returned error:", sessionResult.error);
            
            // On API error, preserve cached session if available
            const currentState = get();
            if (currentState.user && currentState.session) {
              set({ isLoading: false });
            } else {
              // No cached session and error - user needs to login
              set({
                session: null,
                user: null,
                isAuthenticated: false,
                isLoading: false,
                lastSessionCheck: null,
              });
            }
          } else {
            // Explicit null/no session response (user is logged out)
            set({
              session: null,
              user: null,
              isAuthenticated: false,
              isLoading: false,
              lastSessionCheck: null,
            });
          }
        } catch (error) {
          console.warn("Session check failed with exception:", error);

          // On network error (catch block), preserve cached session
          const currentState = get();
          if (currentState.user && currentState.session) {
            // Keep using cached session - user might be offline
            set({ isLoading: false });
          } else {
            // No cached session available
            set({
              session: null,
              user: null,
              isAuthenticated: false,
              isLoading: false,
              lastSessionCheck: null,
            });
          }
        }
      },

      signInWithGoogle: async () => {
        try {
          set({ isLoading: true });

          // Better Auth will redirect, so we don't need to handle response
          await authClient.signIn.social({
            provider: "google",
            callbackURL: `${window.location.origin}/auth/callback`,
          });

          // Browser will redirect before this is reached
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      signInWithApple: async () => {
        try {
          set({ isLoading: true });

          // Better Auth will redirect, so we don't need to handle response
          await authClient.signIn.social({
            provider: "apple",
            callbackURL: `${window.location.origin}/auth/callback`,
          });

          // Browser will redirect before this is reached
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
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);

          // If we have persisted session, use it initially without checking
          if (state.user && state.session && state.isAuthenticated) {
            state.setLoading(false);
            // Don't check session immediately - let components request it if needed
            // This prevents unnecessary API calls on every page load
          } else {
            // No persisted session - will need to check
            state.setLoading(true);
          }
        }
      },
    }
  )
);
