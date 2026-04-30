const DEFAULT_FRONTEND_URL =
  process.env.NODE_ENV === "production"
    ? "https://dailyexpress.app"
    : "http://localhost:3000";

const DEFAULT_DRIVER_APP_URL =
  process.env.NODE_ENV === "production"
    ? "https://driver.dailyexpress.app"
    : "http://localhost:3001";

export const FRONTEND_URL = process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
export const DRIVER_APP_URL =
  process.env.DRIVER_APP_URL || DEFAULT_DRIVER_APP_URL;
export const GOOGLE_AUTH_FAILURE_REDIRECT_URL = `${FRONTEND_URL}/sign-in?error=google_auth_failed`;

export function resolveFrontendRedirect(redirect?: string) {
  if (!redirect) {
    return FRONTEND_URL;
  }

  const allowedOrigins = new Set([
    new URL(FRONTEND_URL).origin,
    new URL(DRIVER_APP_URL).origin,
  ]);

  try {
    const url = new URL(redirect);
    return allowedOrigins.has(url.origin) ? url.toString() : FRONTEND_URL;
  } catch {
    return new URL(
      redirect.startsWith("/") ? redirect : `/${redirect}`,
      FRONTEND_URL,
    ).toString();
  }
}
