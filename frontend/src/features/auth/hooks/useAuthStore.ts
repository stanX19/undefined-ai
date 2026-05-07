import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  userId: string | null;
  accessToken: string | null;
  email: string | null;
  username: string | null;
  educationLevel: string | null;
  planTier: string;
  creditsBalance: number;
  login: (
    token: string,
    userId: string,
    email: string,
    username?: string | null,
    educationLevel?: string | null,
    planTier?: string,
    creditsBalance?: number,
  ) => void;
  setEducationLevel: (level: string) => void;
  setCreditsBalance: (balance: number) => void;
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
      planTier: "free",
      creditsBalance: 0,
      login: (token, userId, email, username = null, educationLevel = null, planTier = "free", creditsBalance = 0) =>
        set({ accessToken: token, userId, email, username, educationLevel, planTier, creditsBalance }),
      setEducationLevel: (level) => set({ educationLevel: level }),
      setCreditsBalance: (balance) => set({ creditsBalance: balance }),
      logout: () =>
        set({ userId: null, accessToken: null, email: null, username: null, educationLevel: null, planTier: "free", creditsBalance: 0 }),
    }),
    {
      name: "auth-storage",
    }
  )
);
