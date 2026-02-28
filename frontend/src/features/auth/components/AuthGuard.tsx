import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../hooks/useAuthStore";

/**
 * Route guard that redirects unauthenticated users to /login.
 * Wrap protected routes with this component.
 */
export function AuthGuard() {
    const userId = useAuthStore((s) => s.userId);

    if (!userId) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}
