import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface OnboardingState {
  // Step 1: Name
  name: string;
  
  // User Type (always "student" by default)
  userType: string;
  
  // Step 2: Learning Goals
  learningGoal: string | null;
  
  // Step 3: Nationality
  nationality: string | null;
  
  // Language (default to English)
  language: string;
  
  // Actions
  setName: (name: string) => void;
  setUserType: (type: string) => void;
  setLearningGoal: (goal: string) => void;
  setNationality: (nationality: string) => void;
  setLanguage: (language: string) => void;
  reset: () => void;
  
  // Helper: Check if onboarding is complete
  isComplete: () => boolean;
  
  // Helper: Get data formatted for API
  getFormattedData: () => {
    learningGoals: string[];
    educationLevel?: string;
    learningStyle?: string;
    preferences?: {
      sessionDuration: number;
      preferredTimeSlots: string[];
      learningPace: string;
    };
  };
}

const initialState = {
  name: "",
  userType: "student", // Default to student for all users
  learningGoal: null,
  nationality: null,
  language: "English", // Default to English for all users
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setName: (name) => set({ name }),
      setUserType: (userType) => set({ userType }),
      setLearningGoal: (learningGoal) => set({ learningGoal }),
      setNationality: (nationality) => set({ nationality }),
      setLanguage: (language) => set({ language }),

      reset: () => set(initialState),

      isComplete: () => {
        const state = get();
        return !!(
          state.name &&
          state.learningGoal &&
          state.nationality
        );
      },

      getFormattedData: () => {
        const state = get();
        
        // Map learning goal to learning goals array
        const learningGoalsMap: Record<string, string> = {
          conversations: "Speak naturally in conversations",
          professional: "Sound professional at work",
          travel: "Travel confidently",
          interviews: "Prepare for Interviews",
        };

        return {
          learningGoals: state.learningGoal
            ? [learningGoalsMap[state.learningGoal] || state.learningGoal]
            : [],
          educationLevel: "undergraduate", // All users are students
          preferences: {
            sessionDuration: 60,
            preferredTimeSlots: [],
            learningPace: "moderate",
          },
        };
      },
    }),
    {
      name: "onboarding-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
