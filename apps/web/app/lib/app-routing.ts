import { env } from "~/env";

function normalizePath(path: string) {
  if (!path) {
    return "/";
  }

  return path.startsWith("/") ? path : `/${path}`;
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

export function buildAuthHref(path: "/sign-in", redirect?: string) {
  if (!redirect) {
    return path;
  }

  const params = new URLSearchParams({ redirect });
  return `${path}?${params.toString()}`;
}