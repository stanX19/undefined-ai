import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  userId: string | null;
  educationLevel: string | null;
  login: (id: string, educationLevel?: string | null) => void;
  setEducationLevel: (level: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      educationLevel: null,
      login: (id, educationLevel = null) => set({ userId: id, educationLevel }),
      setEducationLevel: (level) => set({ educationLevel: level }),
      logout: () => set({ userId: null, educationLevel: null }),
    }),
    {
      name: "auth-storage",
    }
  )
);
