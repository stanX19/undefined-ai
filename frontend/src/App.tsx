import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./features/auth/pages/LoginPage.tsx";
import { OnboardingPage } from "./features/onboarding/OnboardingPage.tsx";
import { WorkspacePage } from "./features/workspace/WorkspacePage.tsx";
import { AuthGuard } from "./features/auth/components/AuthGuard.tsx";
import { useAuthStore } from "./features/auth/hooks/useAuthStore.ts";

/**
 * Root-level redirect: sends unauthenticated users to /login,
 * authenticated users to /onboarding (or /workspace if they already have a topic).
 */
function RootRedirect() {
  const userId = useAuthStore((s) => s.userId);
  if (!userId) return <Navigate to="/login" replace />;
  return <Navigate to="/onboarding" replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes */}
        <Route element={<AuthGuard />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/workspace" element={<WorkspacePage />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
