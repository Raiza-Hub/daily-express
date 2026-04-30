import { JWTPayload } from "../../../shared/types";

// Mock environment variables
process.env.AUTH_SERVICE_URL = "http://localhost:5001";
process.env.NODE_ENV = "test";

// setup.ts
const mockDrizzleClient: any = {
  query: {
    driver: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    driverStats: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
  transaction: jest.fn(async (callback: any) => callback(mockDrizzleClient)),
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn().mockReturnThis(),
      })),
    })),
  })),
  insert: jest.fn().mockReturnValue({
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
  }),
  update: jest.fn().mockReturnValue({
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
  }),
  delete: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
  }),
};

// Properly mock the named export 'db' from your db module
jest.mock("../db/db", () => ({
  db: mockDrizzleClient,
}));

jest.mock("../src/kafka/producer", () => ({
  emitDriverBankVerificationRequested: jest.fn(),
  emitDriverIdentityCreated: jest.fn(),
  emitDriverIdentityUpdated: jest.fn(),
  emitDriverIdentityDeleted: jest.fn(),
  emitDriverPayoutProfileUpserted: jest.fn(),
  emitDriverPayoutProfileDeleted: jest.fn(),
  getProducer: jest.fn(),
}));

// If you need global access for tests
(global as any).mockDrizzle = mockDrizzleClient;

//reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

//global data for test
export const testDriver = {
  id: "test-driver-id",
  userId: "test-user-id",
  firstName: "Test",
  lastName: "User",
  email: "testdriver123@domain.com",
  profile_pic: "https://example.com/test-driver.jpg",
  phone: "0909090909",
  gender: "male",
  country: "Nigeria",
  state: "Lagos State",
  city: "Lagos",
  bankName: "GTBank",
  bankCode: "058",
  accountNumber: "1234567890",
  accountName: "Test User",
  currency: "NGN",
  bankVerificationStatus: "active" as const,
  bankVerificationFailureReason: null,
  bankVerificationRequestedAt: new Date("2025-07-01T00:00:00Z"),
  bankVerifiedAt: new Date("2025-07-01T00:00:00Z"),
  createdAt: new Date("2025-07-01T00:00:00Z"),
  updatedAt: new Date("2025-07-01T00:00:00Z"),
};

export const testUpdateProfileRequest = {
  firstName: "Updated",
  lastName: "User",
  email: "testdriver123@domain.com",
  phone: "0909090909",
  gender: "male" as "male" | "female",
  country: "Nigeria",
  state: "Lagos State",
  city: "Lagos",
  bankName: "GTBank",
  bankCode: "058",
  accountNumber: "1234567890",
  accountName: "Test User",
  profile_pic: "https://example.com/test-driver.jpg",
};

export const testJwtPayload: JWTPayload = {
  userId: "test-user-id",
  email: "testdriver123@domain.com",
  emailVerified: true,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 60 * 15, //15 minutes from now
};

//helper function to reset mocks before each test

export function resetAllMocks() {
  // Reset the relational query mocks
  Object.values(mockDrizzleClient.query.driver).forEach((mock) => {
    if (typeof mock === "function" && "mockReset" in mock) {
      (mock as jest.Mock).mockReset();
    }
  });

  // Reset the core action mocks
  (mockDrizzleClient.insert as jest.Mock).mockClear();
  (mockDrizzleClient.update as jest.Mock).mockClear();
  (mockDrizzleClient.delete as jest.Mock).mockClear();
}

declare global {
  var mockDrizzle: {
    query: {
      driver: {
        findFirst: jest.Mock;
        findMany: jest.Mock;
      };
      driverStats: {
        findFirst: jest.Mock;
        findMany: jest.Mock;
      };
    };
    insert: jest.Mock;
    transaction: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    select: jest.Mock;
  };
}

// Now this will work without the error
global.mockDrizzle = mockDrizzleClient;
