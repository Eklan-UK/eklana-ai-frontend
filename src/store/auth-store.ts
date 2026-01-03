import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { authClient } from "@/lib/auth-client";

interface AuthState {
  user: any | null;
  session: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // Actions
  setUser: (user: any | null) => void;
  setSession: (session: any | null) => void;
  setLoading: (loading: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isLoading: false, // Start as false, will be set by checkSession if needed
      isAuthenticated: false,

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

      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true });
          const result = await authClient.signIn.email({
            email,
            password,
          });

          if (result.data?.user) {
            set({
              user: result.data.user,
              session: result.data, // Store the full response data as session
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            // Check if error is about email verification
            if (
              result.error?.code === "EMAIL_NOT_VERIFIED" ||
              (result.error?.message?.includes("email") &&
                result.error?.message?.includes("verify"))
            ) {
              // Still allow login, but user will be redirected to verification
              // Try to get user data from error or make a session call
              try {
                const sessionResult = await authClient.getSession();
                if (sessionResult?.data?.user) {
                  set({
                    user: sessionResult.data.user,
                    session: sessionResult.data,
                    isAuthenticated: true,
                    isLoading: false,
                  });
                  return; // Don't throw error, allow login to proceed
                }
              } catch (sessionError) {
                // If we can't get session, throw original error
              }
            }
            throw new Error(result.error?.message || "Login failed");
          }
        } catch (error: any) {
          set({ isLoading: false });
          // If error is EMAIL_NOT_VERIFIED, still try to get session
          if (
            error.code === "EMAIL_NOT_VERIFIED" ||
            (error.message?.includes("email") &&
              error.message?.includes("verify"))
          ) {
            try {
              // Try to get session anyway - Better Auth might still create a session
              const sessionResult = await authClient.getSession();
              if (sessionResult?.data?.user) {
                set({
                  user: sessionResult.data.user,
                  session: sessionResult.data,
                  isAuthenticated: true,
                  isLoading: false,
                });
                return; // Success - user is logged in but not verified
              }
            } catch (sessionError) {
              // Continue to throw original error
            }
          }
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
            // Additional fields for Better Auth
            ...(data.firstName && { firstName: data.firstName }),
            ...(data.lastName && { lastName: data.lastName }),
          });

          if (result.data?.user) {
            set({
              user: result.data.user,
              session: result.data, // Store the full response data as session
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            throw new Error(result.error?.message || "Registration failed");
          }
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await authClient.signOut();
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            isLoading: false,
          });
        } catch (error) {
          // Even if logout fails, clear local state
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      checkSession: async (forceRefresh = false) => {
        const state = get();
        
        // If we have cached session and not forcing refresh, use it first
        if (!forceRefresh && state.user && state.session && state.isAuthenticated) {
          // Set loading to false immediately if we have cached data
          set({ isLoading: false });
          
          // Check network session in background (non-blocking)
          authClient.getSession()
            .then((sessionResult) => {
              if (sessionResult?.data?.user) {
                set({
                  user: sessionResult.data.user,
                  session: sessionResult.data,
                  isAuthenticated: true,
                });
              } else {
                // Network says no session, but keep cached for offline
                // Only clear if we're sure (not just network error)
                if (sessionResult?.data === null) {
                  set({
                    session: null,
                    user: null,
                    isAuthenticated: false,
                  });
                }
              }
            })
            .catch(() => {
              // Network error - keep cached session for offline support
              // Don't log out user if network fails
            });
          
          return;
        }

        // No cached session or forcing refresh - check network
        try {
          set({ isLoading: true });
          const sessionResult = await authClient.getSession();
          // Better Auth returns { data: { user, session } } or { data: null }
          if (sessionResult?.data?.user) {
            set({
              user: sessionResult.data.user,
              session: sessionResult.data, // Store full response
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            set({
              session: null,
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch (error) {
          // Network error - if we have cached session, keep it
          const currentState = get();
          if (currentState.user && currentState.session) {
            // Keep cached session for offline support
            set({ isLoading: false });
          } else {
            // No cached session and network failed
            set({
              session: null,
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
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
      };
    },
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
