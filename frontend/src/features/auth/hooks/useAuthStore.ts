import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  userId: string | null;
  accessToken: string | null;
  email: string | null;
  username: string | null;
  educationLevel: string | null;
  login: (token: string, userId: string, email: string, username?: string | null, educationLevel?: string | null) => void;
  setEducationLevel: (level: string) => void;
  /** Stateless logout — clears token + user data from client storage. */
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      accessToken: null,
      email: null,
      username: null,
      educationLevel: null,
      login: (token, userId, email, username = null, educationLevel = null) =>
        set({ accessToken: token, userId, email, username, educationLevel }),
      setEducationLevel: (level) => set({ educationLevel: level }),
      logout: () =>
        set({ userId: null, accessToken: null, email: null, username: null, educationLevel: null }),
    }),
    {
      name: "auth-storage",
    }
  )
);
