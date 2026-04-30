import { env } from "~/env";

const DRIVER_SIGN_UP_PATH = "/sign-up";

function normalizePath(path: string) {
  if (!path) {
    return "/";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function toUrl(value: string, baseUrl: string) {
  try {
    return new URL(value);
  } catch {
    return new URL(normalizePath(value), baseUrl);
  }
}

export function getWebAppUrl() {
  const configuredWebAppUrl = env.NEXT_PUBLIC_WEB_APP_URL;
  if (configuredWebAppUrl !== "http://localhost:3000") {
    return configuredWebAppUrl;
  }

  if (typeof window !== "undefined") {
    if (window.location.hostname === "driver.dailyexpress.app") {
      return `${window.location.protocol}//dailyexpress.app`;
    }

    if (window.location.hostname === "dailyexpress.app") {
      return window.location.origin;
    }
  }

  return "http://localhost:3000";
}

export function getDriverAppUrl() {
  const configuredDriverAppUrl = env.NEXT_PUBLIC_DRIVER_APP_URL;
  if (configuredDriverAppUrl !== "http://localhost:3001") {
    return configuredDriverAppUrl;
  }

  if (typeof window !== "undefined") {
    if (window.location.hostname === "dailyexpress.app") {
      return `${window.location.protocol}//driver.dailyexpress.app`;
    }

    if (window.location.hostname === "driver.dailyexpress.app") {
      return window.location.origin;
    }
  }

  return "http://localhost:3001";
}

export function buildDriverAppUrl(path = "/") {
  return new URL(normalizePath(path), getDriverAppUrl()).toString();
}

export function buildDriverSignUpUrl() {
  return buildDriverAppUrl(DRIVER_SIGN_UP_PATH);
}

export function buildAuthHref(path: "/sign-in" | "/sign-up", redirect?: string) {
  if (!redirect) {
    return path;
  }

  const params = new URLSearchParams({ redirect });
  return `${path}?${params.toString()}`;
}

export function buildVerifyEmailHref(redirect?: string) {
  if (!redirect) {
    return "/verify-email";
  }

  const params = new URLSearchParams({ redirect });
  return `/verify-email?${params.toString()}`;
}

export function isDriverAppRedirect(redirect?: string | null) {
  if (!redirect) {
    return false;
  }

  const requestedUrl = toUrl(redirect, getWebAppUrl());
  return requestedUrl.origin === new URL(getDriverAppUrl()).origin;
}

export function isDriverSignUpRedirect(redirect?: string | null) {
  if (!redirect) {
    return false;
  }

  const requestedUrl = toUrl(redirect, getWebAppUrl());
  const driverSignUpUrl = new URL(buildDriverSignUpUrl());

  return (
    requestedUrl.origin === driverSignUpUrl.origin &&
    requestedUrl.pathname === driverSignUpUrl.pathname
  );
}

export function resolvePostAuthDestination({
  redirect,
  isDriver,
}: {
  redirect?: string;
  isDriver: boolean;
}) {
  if (isDriver) {
    if (!redirect || isDriverSignUpRedirect(redirect)) {
      return buildDriverAppUrl("/");
    }

    return redirect;
  }

  if (redirect && isDriverAppRedirect(redirect)) {
    return buildDriverSignUpUrl();
  }

  return redirect || "/";
}
