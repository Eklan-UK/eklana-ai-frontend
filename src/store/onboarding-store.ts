import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface OnboardingState {
  // Step 1: Name
  name: string;
  
  // Step 2: User Type
  userType: string | null; // "professional" | "student" | "browsing" | "ancestor"
  
  // Step 3: Learning Goals
  learningGoal: string | null; // "conversations" | "professional" | "travel" | "interviews"
  
  // Step 4: Nationality
  nationality: string | null;
  
  // Step 5: Language
  language: string | null;
  
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
  userType: null,
  learningGoal: null,
  nationality: null,
  language: null,
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
          state.userType &&
          state.learningGoal &&
          state.nationality &&
          state.language
        );
      },

      getFormattedData: () => {
        const state = get();
        
        // Map user type to education level
        const educationLevelMap: Record<string, string> = {
          student: "undergraduate",
          professional: "professional",
          browsing: "undergraduate",
          ancestor: "professional",
        };

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
          educationLevel:
            state.userType && educationLevelMap[state.userType]
              ? educationLevelMap[state.userType]
              : undefined,
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


