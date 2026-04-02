import axios from "axios";

const API_GATEWAY_URL =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:8000";

const DRIVER_BASE_URL = `${API_GATEWAY_URL}/api/drivers/v1`;
const AUTH_BASE_URL = `${API_GATEWAY_URL}/api/auth/v1`;
const ROUTE_BASE_URL = `${API_GATEWAY_URL}/api/routes/v1`;
const PAYMENT_BASE_URL = `${API_GATEWAY_URL}/api/payments/v1`;

export const api = axios.create({
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
