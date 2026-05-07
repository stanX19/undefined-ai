import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { LoginPage } from "./features/auth/pages/LoginPage.tsx";
import { RegisterPage } from "./features/auth/pages/RegisterPage.tsx";
import { OnboardingPage } from "./features/onboarding/OnboardingPage.tsx";
import { MenuPage } from "./features/onboarding/MenuPage.tsx";
import { WorkspacePage } from "./features/workspace/WorkspacePage.tsx";
import { AuthGuard } from "./features/auth/components/AuthGuard.tsx";
import { useAuthStore } from "./features/auth/hooks/useAuthStore.ts";
import { SharedViewPage } from "./features/workspace/SharedViewPage.tsx";

function RootRedirect() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const educationLevel = useAuthStore((s) => s.educationLevel);
  if (!accessToken) return <Navigate to="/login" replace />;
  if (!educationLevel) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/menu" replace />;
}

/** Ensures user has completed onboarding (education level) before accessing menu/workspace/home. */
function RequireEducation({ children }: { children: React.ReactNode }) {
  const educationLevel = useAuthStore((s) => s.educationLevel);
  if (!educationLevel) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

export function App() {
  useEffect(() => {
    const apiBase = (import.meta as any).env.VITE_API_URL as string | undefined;
    if (!apiBase) return;

    const base = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
    void fetch(`${base}/health`).catch(() => undefined);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes - / redirects via RootRedirect; landing/ (Next.js) links here on Login */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/share/:token" element={<SharedViewPage />} />

        {/* Protected routes */}
        <Route element={<AuthGuard />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/menu" element={<RequireEducation><MenuPage /></RequireEducation>} />
          <Route path="/home" element={<RequireEducation><WorkspacePage /></RequireEducation>} />
          <Route path="/workspace" element={<RequireEducation><WorkspacePage /></RequireEducation>} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
