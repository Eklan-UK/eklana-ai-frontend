import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_ENGLISH_ACCENT } from "@/services/tts-accent-voices";

interface OnboardingState {
  // Step 1: Name
  name: string;
  
  // User Type (always "student" by default)
  userType: string;
  
  // Step 2: Learning Goals (multiple selection)
  learningGoals: string[];
  
  // Step 3: Nationality
  nationality: string | null;
  
  // Step 4: English accent (lesson preference voice key)
  englishAccent: string;
  
  // Language (default to English)
  language: string;
  
  // Actions
  setName: (name: string) => void;
  setUserType: (type: string) => void;
  setLearningGoals: (goals: string[]) => void;
  setNationality: (nationality: string | null) => void;
  setEnglishAccent: (accent: string) => void;
  setLanguage: (language: string) => void;
  reset: () => void;
  
  // Helper: Check if onboarding is complete
  isComplete: () => boolean;
  
  // Helper: Get data formatted for API
  getFormattedData: () => {
    learningGoals: string[];
    nationality?: string;
    language?: string;
    userType?: string;
    educationLevel?: string;
    learningStyle?: string;
    preferences?: {
      sessionDuration: number;
      preferredTimeSlots: string[];
      learningPace: string;
    };
    lessonPreferences?: {
      englishAccent: string;
    };
  };
}

const initialState = {
  name: "",
  userType: "student", // Default to student for all users
  learningGoals: [], // Now an array for multiple selection
  nationality: null,
  englishAccent: DEFAULT_ENGLISH_ACCENT,
  language: "English", // Default to English for all users
};

// Map goal IDs to readable labels
const learningGoalsMap: Record<string, string> = {
  conversations: "Speak naturally in conversations",
  professional: "Sound professional at work",
  travel: "Travel confidently",
  interviews: "Prepare for Interviews",
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setName: (name) => set({ name }),
      setUserType: (userType) => set({ userType }),
      setLearningGoals: (learningGoals) => set({ learningGoals }),
      setNationality: (nationality) => set({ nationality }),
      setEnglishAccent: (englishAccent) => set({ englishAccent }),
      setLanguage: (language) => set({ language }),

      reset: () => set(initialState),

      isComplete: () => {
        const state = get();
        return !!(
          state.name &&
          state.learningGoals.length > 0 &&
          state.nationality &&
          state.englishAccent
        );
      },

      getFormattedData: () => {
        const state = get();
        
        // Map goal IDs to readable labels
        const formattedGoals = state.learningGoals.map(
          (goalId) => learningGoalsMap[goalId] || goalId
        );

        return {
          learningGoals: formattedGoals,
          nationality: state.nationality ?? undefined,
          language: state.language,
          userType: state.userType,
          educationLevel: "undergraduate", // All users are students
          preferences: {
            sessionDuration: 60,
            preferredTimeSlots: [],
            learningPace: "moderate",
          },
          lessonPreferences: {
            englishAccent: state.englishAccent,
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
