// shared typescript types

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  // phone: string;
  dateOfBirth: Date;
  emailVerified: boolean;
  referal: string;
  createdAt: Date;
  updatedAt: Date;
  hasPassword?: boolean;
}

export interface GetMeResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  // phone?: string;
  dateOfBirth?: Date;
}

export interface Driver {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  profile_pic?: string | null;
  phone: string;
  gender: "male" | "female" | "other";
  country: string;
  state: string;
  city: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  profile_pic?: string;
  phone?: string;
  gender?: "male" | "female" | "other";
  country?: string;
  state?: string;
  city?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  emailVerified: boolean;
  iat: number;
  exp: number;
}

export class ServiceError extends Error {
  statusCode: number;
  code?: string;
  details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: any,
  ) {
    super(message);
    this.name = "ServiceError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function logError(error: Error, context?: Record<string, any>): void {
  console.error("Error occured", {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });
}

export interface Route {
  id: string;
  driverId: string;
  pickup_location_title: string;
  pickup_location_locality: string;
  pickup_location_label: string;
  dropoff_location_title: string;
  dropoff_location_locality: string;
  dropoff_location_label: string;
  intermediate_stops_title: string | null;
  intermediate_stops_locality: string | null;
  intermediate_stops_label: string | null;
  vehicleType: "car" | "bus" | "luxury_car";
  availableSeats: number;
  price: number;
  departure_time: Date;
  arrival_time: Date;
  status: "inactive" | "pending" | "active";
  createdAt: Date;
  updatedAt: Date;
}
export interface CreateRoute {
  driverId: string;
  pickup_location_title: string;
  pickup_location_locality: string;
  pickup_location_label: string;
  dropoff_location_title: string;
  dropoff_location_locality: string;
  dropoff_location_label: string;
  intermediate_stops_title: string | null;
  intermediate_stops_locality: string | null;
  intermediate_stops_label: string | null;
  vehicleType: "car" | "bus" | "luxury_car";
  availableSeats: number;
  price: number;
  departure_time: Date;
  arrival_time: Date;
  status: "inactive" | "pending" | "active";
}

export interface updateRouteRequest {
  pickup_location_title?: string;
  pickup_location_locality?: string;
  pickup_location_label?: string;
  dropoff_location_title?: string;
  dropoff_location_locality?: string;
  dropoff_location_label?: string;
  intermediate_stops_title?: string | null;
  intermediate_stops_locality?: string | null;
  intermediate_stops_label?: string | null;
  vehicleType?: "car" | "bus" | "luxury_car";
  availableSeats?: number;
  price?: number;
  departure_time?: Date;
  arrival_time?: Date;
  status?: "inactive" | "pending" | "active";
}

export interface CreateTrip {
  routeId: string;
  driverId: string;
  date: Date;
  capacity: number;
  bookedSeats: number;
  status: "pending" | "confirmed" | "cancelled" | "completed";
}

export interface Trip {
  id: string;
  routeId: string;
  driverId: string;
  date: Date;
  capacity: number;
  bookedSeats: number;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

export interface Booking {
  id: string;
  tripId: string;
  userId: string;
  seatNumber: number;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBooking {
  tripId: string;
  userId: string;
  seatNumber: number;
  status: "pending" | "confirmed" | "cancelled" | "completed";
}

export interface updateBookingRequest {
  tripId?: string;
  userId?: string;
  seatNumber?: number;
  status?: "pending" | "confirmed" | "cancelled" | "completed";
}
