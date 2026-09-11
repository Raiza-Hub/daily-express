// shared typescript types

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  emailVerified: boolean;
  referral: string | null;
  createdAt: Date;
  updatedAt: Date;
  profilePictureUrl?: string | null;
  phone?: string | null;
  gender?: string | null;
}

export interface OnboardingInput {
  phoneNumber: string;
  dateOfBirth: Date;
  gender: "male" | "female";
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  phoneNumber?: string;
  gender?: "male" | "female";
}

export interface CreateDriverRequest {
  firstName: string;
  lastName: string;
  email: string;
  profile_pic?: string;
  phone: string;
  country: string;
  currency: string;
  state: string;
  city: string;
  address: string;
}

export interface Driver {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  profile_pic?: string | null;
  phone: string;
  address: string;
  country: string;
  currency: string;
  state: string;
  city: string;
  bankName: string | null;
  bankCode: string | null;
  accountNumber: string | null;
  accountName: string | null;
  bankVerificationStatus: BankVerificationStatus;
  kycStatus: KycStatus;
  kycType?: string | null;
  kycVerificationReference?: string | null;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type BankVerificationStatus = "active" | "failed" | null;
export type KycStatus = "active" | "failed" | null;

export interface DriverPublicProfile {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  profile_pic?: string | null;
  country: string;
  state: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  profile_pic?: string;
  phone?: string;
  country?: string;
  currency?: string;
  state?: string;
  city?: string;
  address?: string;
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  kycType?: string;
  kycId?: string;
  kycConsent?: boolean;
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

export interface JWTPayload {
  userId: string;
  email: string;
  emailVerified: boolean;
  iat?: number;
  exp?: number;
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
  origin_title: string;
  origin_locality: string;
  origin_label: string;
  destination_title: string | null;
  destination_locality: string | null;
  destination_label: string | null;
  train_station_title: string | null;
  train_station_locality: string | null;
  train_station_label: string | null;
  pickup_point: string;
  dropoff_point: string;
  price: number;
  fee: number | null;
  luggage_fee: number;
  departure_time: string[];
  arrival_time: string[];
  status: "inactive" | "pending" | "active";
  createdAt: Date;
  updatedAt: Date;
}
export interface CreateRoute {
  origin_title: string;
  origin_locality: string;
  origin_label: string;
  destination_title: string | null;
  destination_locality: string | null;
  destination_label: string | null;
  train_station_title: string | null;
  train_station_locality: string | null;
  train_station_label: string | null;
  pickup_point: string;
  dropoff_point: string;
  price: number;
  luggage_fee: number;
  fee?: number | null;
  departure_time: string[];
  arrival_time: string[];
  status: "inactive" | "pending" | "active";
}

export interface SearchRoutesRequest {
  origin: string;
}

export interface updateRouteRequest {
  origin_title?: string;
  origin_locality?: string;
  origin_label?: string;
  destination_title?: string | null;
  destination_locality?: string | null;
  destination_label?: string | null;
  train_station_title?: string | null;
  train_station_locality?: string | null;
  train_station_label?: string | null;
  pickup_point?: string;
  dropoff_point?: string;
  price?: number;
  luggage_fee?: number;
  fee?: number | null;
  departure_time?: string[];
  arrival_time?: string[];
  status?: "inactive" | "pending" | "active";
}

export type TripStatus = "pending" | "confirmed" | "cancelled" | "completed" | "awaiting_driver";

export interface CreateTrip {
  routeId: string;
  date: string;
  driverId?: string;
  capacity?: number;
  bookedSeats?: number;
  status?: TripStatus;
}

export interface Trip {
  id: string;
  routeId: string;
  driverId: string | null;
  date: Date;
  departureTime: string;
  arrivalTime: string;
  capacity: number;
  bookedSeats: number;
  status: TripStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverTripDetails extends Trip {
  route: Route;
  earnings: number;
}

export interface TripsSummary {
  date: string;
  totalEarnings: number;
  totalTrips: number;
  totalPassengers: number;
  totalRoutes: number;
  trips: DriverTripDetails[];
}

export interface Booking {
  id: string;
  tripId: string | null;
  userId: string;
  departureTime: string;
  arrivalTime: string;
  boardingPoint: "pickup" | "dropoff";
  luggageCount: number;
  totalAmount: number;
  totalFee: number;
  currency: string;
  status: TripStatus;
  paymentReference?: string | null;
  paymentStatus?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Passenger {
  id: string;
  bookingId: string;
  fullName: string;
  email: string;
  phone: string;
  carriesLuggage: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PassengerInput {
  fullName: string;
  email: string;
  phone: string;
  carriesLuggage: boolean;
}

export interface UserBookingDetails extends Booking {
  trip: DriverTripDetails;
}

export interface CreateBooking {
  routeId: string;
  tripDate: string;
  tripType: "departure" | "arrival";
  selectedTime: string;
  boardingPoint: "pickup" | "dropoff";
  passengers: PassengerInput[];
}

export interface updateBookingRequest {
  tripId?: string;
  userId?: string;
  seatNumber?: number;
  status?: "pending" | "confirmed" | "cancelled" | "completed";
  paymentReference?: string;
  paymentStatus?: string;
}

export type PaymentStatus =
  | "initialized"
  | "pending"
  | "successful"
  | "failed"
  | "cancelled"
  | "expired"
  | "refund_pending"
  | "refunded"
  | "refund_failed";

export const KORA_CHECKOUT_CHANNELS = [
  "bank_transfer",
  "card",
  "pay_with_bank",
  "mobile_money",
] as const;

export type KoraCheckoutChannel = (typeof KORA_CHECKOUT_CHANNELS)[number];

export interface Payment {
  id: string;
  userId: string;
  bookingId?: string | null;
  reference: string;
  amount: number;
  currency: string;
  productName: string;
  productDescription: string;
  customerEmail?: string | null;
  status: PaymentStatus;
  checkoutUrl?: string | null;
  redirectUrl: string;
  cancelUrl?: string | null;
  failedAt?: Date | null;
  failureCode?: string | null;
  failureReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTripCheckoutRequest {
  routeId: string;
  tripDate: string;
  tripType: "departure" | "arrival";
  selectedTime: string;
  boardingPoint: "pickup" | "dropoff";
  passengers: PassengerInput[];
  channels?: KoraCheckoutChannel[];
  productName: string;
  productDescription: string;
}

export interface TripCheckout {
  bookingId: string;
  paymentReference: string;
  checkoutUrl?: string | null;
}

export type EarningStatus =
  | "pending_trip_completion"
  | "available"
  | "processing"
  | "paid"
  | "cancelled";

export type PayoutStatus =
  | "processing"
  | "success"
  | "failed";

export interface DriverPayout {
  id: string;
  driverId: string;
  tripId?: string | null;
  reference: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  failureCode?: string | null;
  failureReason?: string | null;
  failedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverPayoutHistoryItem extends DriverPayout {
  recipientBankName?: string | null;
  recipientAccountLast4?: string | null;
}

export interface ResolveBankAccountRequest {
  bankCode: string;
  accountNumber: string;
  currency: string;
}

export interface ResolveBankAccountResponse {
  accountName: string;
  bankName: string;
  bankCode: string;
}

export type VehicleStatus = "available" | "in_use";

export interface Vehicle {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  capacity: number;
  color: string;
  status: VehicleStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleRequest {
  plateNumber: string;
  make: string;
  model: string;
  capacity: number;
  color: string;
}

export interface UpdateVehicleRequest {
  plateNumber?: string;
  make?: string;
  model?: string;
  capacity?: number;
  color?: string;
}

export interface DriverInfoResponse {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  country: string;
  state: string;
  profilePictureUrl: string | null;
  vehicleMake: string;
  vehicleModel: string;
  vehiclePlateNumber: string;
  vehicleColor: string;
}
