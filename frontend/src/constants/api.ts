/**
 * Centralized API fetch wrapper that auto-attaches the Bearer token.
 *
 * Usage:
 *   import { apiFetch } from "@/constants/api";
 *   const data = await apiFetch("/api/v1/topics/");
 */
import { useAuthStore } from "../features/auth/hooks/useAuthStore";

/** Return Authorization header if a token exists, empty object otherwise. */
export function getAuthHeaders(): Record<string, string> {
    const token = useAuthStore.getState().accessToken;
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
}

/**
 * Thin wrapper around `fetch` that injects the bearer token automatically.
 * Mirrors the native `fetch` signature so it's a drop-in replacement.
 */
export async function apiFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<Response> {
    const authHeaders = getAuthHeaders();

    const mergedHeaders: Record<string, string> = {
        ...authHeaders,
        ...((init?.headers as Record<string, string>) ?? {}),
    };

    return fetch(input, { ...init, headers: mergedHeaders });
}
