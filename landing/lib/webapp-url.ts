/**
 * Webapp URL for Login / Start for free links.
 * Set NEXT_PUBLIC_WEBAPP_URL in .env.local (e.g. http://localhost:5173 for dev).
 */
export const WEBAPP_URL = process.env.NEXT_PUBLIC_WEBAPP_URL ?? "http://localhost:5173";

export const WEBAPP_LOGIN_URL = `${WEBAPP_URL}/login`;
