import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../hooks/useAuthStore";

/**
 * Route guard that redirects unauthenticated users to /login.
 * Checks for the presence of a JWT access token (not just userId).
 */
export function AuthGuard() {
    const accessToken = useAuthStore((s) => s.accessToken);

    if (!accessToken) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}
