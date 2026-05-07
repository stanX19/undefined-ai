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
  dailyFreeUnits: number;
  unitsUsedToday: number;
  login: (
    token: string,
    userId: string,
    email: string,
    username?: string | null,
    educationLevel?: string | null,
    planTier?: string,
    creditsBalance?: number,
    dailyFreeUnits?: number,
    unitsUsedToday?: number,
  ) => void;
  setEducationLevel: (level: string) => void;
  setCreditsBalance: (balance: number) => void;
  setUsageSnapshot: (dailyFreeUnits: number, unitsUsedToday: number) => void;
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
      dailyFreeUnits: 0,
      unitsUsedToday: 0,
      login: (
        token,
        userId,
        email,
        username = null,
        educationLevel = null,
        planTier = "free",
        creditsBalance = 0,
        dailyFreeUnits = 0,
        unitsUsedToday = 0
      ) =>
        set({
          accessToken: token,
          userId,
          email,
          username,
          educationLevel,
          planTier,
          creditsBalance,
          dailyFreeUnits,
          unitsUsedToday,
        }),
      setEducationLevel: (level) => set({ educationLevel: level }),
      setCreditsBalance: (balance) => set({ creditsBalance: balance }),
      setUsageSnapshot: (dailyFreeUnits, unitsUsedToday) => set({ dailyFreeUnits, unitsUsedToday }),
      logout: () =>
        set({
          userId: null,
          accessToken: null,
          email: null,
          username: null,
          educationLevel: null,
          planTier: "free",
          creditsBalance: 0,
          dailyFreeUnits: 0,
          unitsUsedToday: 0,
        }),
    }),
    {
      name: "auth-storage",
    }
  )
);
