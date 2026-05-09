import axios from "axios";

const DAILYEXPRESS_API_URL =
  process.env.NEXT_PUBLIC_DAILYEXPRESS_API_URL || "http://localhost:8000";

const DRIVER_BASE_URL = `${DAILYEXPRESS_API_URL}/api/v1/driver`;
const AUTH_BASE_URL = `${DAILYEXPRESS_API_URL}/api/v1/auth`;
const ROUTE_BASE_URL = `${DAILYEXPRESS_API_URL}/api/v1/route`;
const PAYMENT_BASE_URL = `${DAILYEXPRESS_API_URL}/api/v1/payments`;
const PAYOUT_BASE_URL = `${DAILYEXPRESS_API_URL}/api/v1/payouts`;
const NOTIFICATION_BASE_URL = `${DAILYEXPRESS_API_URL}/api/v1/notifications`;

export const driverApi = axios.create({
  baseURL: DRIVER_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

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

export const paymentApi = axios.create({
  baseURL: PAYMENT_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

export const payoutApi = axios.create({
  baseURL: PAYOUT_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

export const notificationApi = axios.create({
  baseURL: NOTIFICATION_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});
