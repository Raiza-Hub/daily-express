// import { JWTPayload } from "../../../shared/types";

// // Mock environment variables
// process.env.JWT_SECRET = "test-jwt-secret-key-for-testing-only";
// process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret-key-for-testing-only";
// process.env.JWT_EXPIRES_IN = "15m";
// process.env.JWT_REFRESH_EXPIRES_IN = "7d";
// process.env.BCRYPT_ROUNDS = "4"; // Lower rounds for faster tests
// process.env.NODE_ENV = "test";

// // setup.ts
// const mockDrizzleClient = {
//   query: {
//     users: {
//       findFirst: jest.fn(),
//       findMany: jest.fn(),
//     },
//   },
//   select: jest.fn(() => ({
//     from: jest.fn(() => ({
//       where: jest.fn(() => ({
//         limit: jest.fn().mockReturnThis(),
//       })),
//     })),
//   })),
//   insert: jest.fn().mockReturnValue({
//     values: jest.fn().mockReturnThis(),
//     returning: jest.fn().mockReturnThis(),
//   }),
//   update: jest.fn().mockReturnThis(),
//   delete: jest.fn().mockReturnThis(),
// };

// const mockOtpClient = {
//   query: {
//     otp: {
//       findFirst: jest.fn(),
//       findMany: jest.fn(),
//     },
//   },
//   select: jest.fn(() => ({
//     from: jest.fn(() => ({
//       where: jest.fn(() => ({
//         limit: jest.fn().mockReturnThis(),
//       })),
//     })),
//   })),
//   insert: jest.fn().mockReturnValue({
//     values: jest.fn().mockReturnThis(),
//     returning: jest.fn().mockReturnThis(),
//   }),
//   update: jest.fn().mockReturnThis(),
//   delete: jest.fn().mockReturnThis(),
// };

// // Properly mock the named export 'db' from your db module
// jest.mock("../db/db", () => ({
//   db: mockDrizzleClient,
//   otp: mockOtpClient,
// }));

// // If you need global access for tests
// (global as any).mockDrizzle = mockDrizzleClient;

// //global data for test
// export const testUser = {
//   id: "test-user-id",
//   email: "testuser123@domain.com",
//   firstName: "John",
//   lastName: "Doe",
//   phone: "1234567890",
//   dateOfBirth: new Date("1990-01-01"),
//   password: "$$2a$04$hashedpasswordhashedpasswordhashedpasswordhashedpassword",
//   createdAt: new Date("2025-07-01T00:00:00Z"),
//   updatedAt: new Date("2025-07-01T00:00:00Z"),
// };

// export const testOtp = {
//   id: "test-otp-id",
//   email: testUser.email,
//   otp: "123456",
//   expiresAt: new Date(Date.now() + 10 * 60 * 1000),
//   createdAt: new Date("2025-07-01T00:00:00Z"),
//   updatedAt: new Date("2025-07-01T00:00:00Z"),
// };

// export const testJwtPayload: JWTPayload = {
//   userId: "test-user-id",
//   email: testUser.email,
//   iat: Math.floor(Date.now() / 1000),
//   exp: Math.floor(Date.now() / 1000) + 60 * 15, //15 minutes from now
// };

// export function resetAllMocks() {
//   // Reset the relational query mocks
//   Object.values(mockOtpClient.query.otp).forEach((mock) => {
//     if (typeof mock === "function" && "mockReset" in mock) {
//       (mock as jest.Mock).mockReset();
//     }
//   });
//   Object.values(mockDrizzleClient.query.users).forEach((mock) => {
//     if (typeof mock === "function" && "mockReset" in mock) {
//       (mock as jest.Mock).mockReset();
//     }
//   });

//   // Reset the core action mocks
//   (mockDrizzleClient.insert as jest.Mock).mockClear();
//   (mockDrizzleClient.update as jest.Mock).mockClear();
//   (mockDrizzleClient.delete as jest.Mock).mockClear();

//   (mockOtpClient.insert as jest.Mock).mockClear();
//   (mockOtpClient.update as jest.Mock).mockClear();
//   (mockOtpClient.delete as jest.Mock).mockClear();
// }

// declare global {
//   var mockOtp: typeof mockOtpClient;
//   var mockDrizzle: typeof mockDrizzleClient; // Using 'var' is required for global augmentation

//   //used to be any
// }

// // Now this will work without the error
// global.mockOtp = mockOtpClient;
// global.mockDrizzle = mockDrizzleClient;

import { JWTPayload } from "../../../shared/types";

// Mock environment variables
process.env.JWT_SECRET = "test-jwt-secret-key-for-testing-only";
process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret-key-for-testing-only";
process.env.JWT_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";
process.env.BCRYPT_ROUNDS = "4";
process.env.NODE_ENV = "test";

// Unified mock client to handle all independent tables
const mockDrizzleClient = {
  query: {
    users: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    otp: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn().mockReturnThis(),
      })),
    })),
  })),
  insert: jest.fn().mockReturnValue({
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
  }),
  update: jest.fn().mockReturnValue({
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
  }),
  delete: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
  }),
};

// Properly mock the named export 'db'
jest.mock("../db/db", () => ({
  db: mockDrizzleClient,
}));

// Global access for tests
(global as any).mockDrizzle = mockDrizzleClient;

// Global data for tests
export const testUser = {
  id: "test-user-id",
  email: "testuser123@domain.com",
  firstName: "John",
  lastName: "Doe",
  phone: "1234567890",
  emailVerified: false,
  dateOfBirth: new Date("1990-01-01"),
  password: "$$2a$04$hashedpasswordhashedpasswordhashedpasswordhashedpassword",
  referal: "",
  createdAt: new Date("2025-07-01T00:00:00Z"),
  updatedAt: new Date("2025-07-01T00:00:00Z"),
};

export const testOtp = {
  id: "test-otp-id",
  email: testUser.email,
  otp: "123456",
  expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  createdAt: new Date("2025-07-01T00:00:00Z"),
  updatedAt: new Date("2025-07-01T00:00:00Z"),
};

export const testJwtPayload: JWTPayload = {
  userId: "test-user-id",
  email: testUser.email,
  // was throwing an error for emailVerified
  emailVerified: false,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 60 * 15,
};

export function resetAllMocks() {
  jest.clearAllMocks();

  // Reset the relational query mocks specifically
  Object.values(mockDrizzleClient.query.users).forEach((mock) => {
    if (typeof mock === "function" && "mockReset" in mock) {
      (mock as jest.Mock).mockReset();
    }
  });

  Object.values(mockDrizzleClient.query.otp).forEach((mock) => {
    if (typeof mock === "function" && "mockReset" in mock) {
      (mock as jest.Mock).mockReset();
    }
  });
}

declare global {
  var mockDrizzle: typeof mockDrizzleClient;
}

global.mockDrizzle = mockDrizzleClient;
