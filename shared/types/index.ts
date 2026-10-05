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
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  kycType: "bvn" | "nin";
  kycId: string;
}

export interface VerifyBankRequest {
  bankCode: string;
  accountNumber: string;
  currency: string;
}

export interface VerifyBankResponse {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

export interface VerifyKycRequest {
  kycType: "bvn" | "nin";
  kycId: string;
}

export interface VerifyKycResponse {
  reference: string;
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
  isDriver?: boolean;
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

export interface Destination {
  id: string;
  title: string;
  locality: string;
  status: "inactive" | "pending" | "active";
  createdAt: string;
  updatedAt: string;
}

export interface OriginDetails {
  id: string;
  title: string;
  meetingPoint: string;
  departureTime: string[];
  price: number;
  fee: number;
  luggageFee: number;
  destinations: Array<{ id: string; title: string }>;
}

export interface Origin {
  id: string;
  title: string;
  locality: string;
  meetingPoint: string;
  departureTime: string[];
  price: number;
  fee: number;
  luggageFee: number;
  destinationIds: string[];
  destinations: Destination[];
  status: "inactive" | "pending" | "active";
  createdAt: string;
  updatedAt: string;
}

export type TripStatus = "cancelled" | "completed" | "awaiting_driver";

export type DriverCalendarEventStatus = "pending" | "successful" | "cancelled";

export interface DriverCalendarTrip {
  id: string;
  origin: string;
  destination: string;
  date: string;
  departureTime: string;
  price: number;
  status: DriverCalendarEventStatus;
  tripStatus: TripStatus;
}

export type BookingStatus = "pending" | "confirmed" | "cancelled";

export interface Trip {
  id: string;
  originId: string;
  destinationId: string;
  driverId: string | null;
  date: string;
  departureTime: string;
  capacity: number;
  bookedSeats: number;
  status: TripStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Booking {
  id: string;
  originId: string;
  destinationId: string;
  tripId: string | null;
  tripDate: string;
  userId: string;
  departureTime: string;
  luggageCount: number;
  totalAmount: number;
  totalFee: number;
  currency: string;
  status: BookingStatus;
  paymentReference?: string | null;
  paymentStatus?: PaymentStatus;
  refundStatus?: RefundStatus | null;
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

export interface CreateBooking {
  originId: string;
  destinationId: string;
  tripDate: string;
  departureTime: string;
  passengers: PassengerInput[];
}

export type TransactionStatus = "pending" | "successful" | "failed";

export type PaymentStatus = TransactionStatus;

export type RefundStatus = TransactionStatus;

export const KORA_CHECKOUT_CHANNELS = ["bank_transfer"] as const;

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
  refundId?: string | null;
  checkoutUrl?: string | null;
  redirectUrl: string;
  cancelUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTripCheckoutRequest {
  originId: string;
  destinationId: string;
  tripDate: string;
  departureTime: string;
  passengers: PassengerInput[];
  channels?: KoraCheckoutChannel[];
}

export interface TripCheckout {
  bookingId: string;
  paymentReference: string;
  checkoutUrl?: string | null;
}

export type PayoutStatus =
  | "pending"
  | "successful"
  | "failed";

export interface DriverPayout {
  id: string;
  driverId: string;
  tripId?: string | null;
  reference: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverPayoutHistoryItem extends DriverPayout {
  recipientBankName?: string | null;
  recipientAccountLast4?: string | null;
}
