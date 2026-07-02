import axios, { InternalAxiosRequestConfig } from "axios";

const DAILYEXPRESS_API_URL =
  process.env.NEXT_PUBLIC_DAILYEXPRESS_API_URL || "http://localhost:8000";

const DRIVER_BASE_URL = `${DAILYEXPRESS_API_URL}/api/v1/driver`;
const AUTH_BASE_URL = `${DAILYEXPRESS_API_URL}/api/v1/auth`;
const ROUTE_BASE_URL = `${DAILYEXPRESS_API_URL}/api/v1/route`;
const PAYMENT_BASE_URL = `${DAILYEXPRESS_API_URL}/api/v1/payments`;
const PAYOUT_BASE_URL = `${DAILYEXPRESS_API_URL}/api/v1/payouts`;
const NOTIFICATION_BASE_URL = `${DAILYEXPRESS_API_URL}/api/v1/notifications`;

const CSRF_HEADER_NAME = "X-CSRF-Token";

let csrfToken: string | null = null;

export function setCsrfToken(token: string) {
  csrfToken = token;
}

function addCsrfHeader(config: InternalAxiosRequestConfig) {
  if (config.method && !["get", "head", "options"].includes(config.method)) {
    if (csrfToken) {
      config.headers[CSRF_HEADER_NAME] = csrfToken;
    }
  }
  return config;
}

export const driverApi = axios.create({
  baseURL: DRIVER_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});
driverApi.interceptors.request.use(addCsrfHeader);

export const authApi = axios.create({
  baseURL: AUTH_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

export const routeApi = axios.create({
  baseURL: ROUTE_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});
routeApi.interceptors.request.use(addCsrfHeader);

export const paymentApi = axios.create({
  baseURL: PAYMENT_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});
paymentApi.interceptors.request.use(addCsrfHeader);

export const payoutApi = axios.create({
  baseURL: PAYOUT_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});
payoutApi.interceptors.request.use(addCsrfHeader);

export const notificationApi = axios.create({
  baseURL: NOTIFICATION_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});
notificationApi.interceptors.request.use(addCsrfHeader);


