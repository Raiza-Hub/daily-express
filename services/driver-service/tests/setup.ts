import axios from "axios";
import { JWTPayload } from "../../../shared/types";

// Mock environment variables
process.env.AUTH_SERVICE_URL = "http://localhost:3001";
process.env.NODE_ENV = "test";

// setup.ts
const mockDrizzleClient = {
  query: {
    driver: {
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
    returning: jest.fn().mockReturnThis(),
  }),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

// //Mock the database module
// jest.mock("../src/database", () => mockDrizzleClient);

// Properly mock the named export 'db' from your db module
jest.mock("../db/db", () => ({
  db: mockDrizzleClient,
}));

//mock axios for authClient
// jest.mock("axios");
jest.mock("axios", () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    create: jest.fn().mockReturnThis(),
  },
  get: jest.fn(),
  post: jest.fn(),
  create: jest.fn().mockReturnThis(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

// If you need global access for tests
(global as any).mockDrizzle = mockDrizzleClient;
(global as any).mockAxios = mockedAxios;

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
  accountNumber: "1234567890",
  accountName: "Test User",
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
  accountNumber: "1234567890",
  accountName: "Test User",
  profile_pic: "https://example.com/test-driver.jpg",
};

export const testJwtPayload: JWTPayload = {
  userId: "test-user-id",
  email: "testdriver123@domain.com",
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

// declare global {
//   var mockDrizzle: typeof mockDrizzleClient;
// }

declare global {
  // Changing this to 'any' or a more flexible type
  // prevents the 'never' conflict across all test files
  var mockDrizzle: {
    query: {
      driver: {
        findFirst: jest.Mock;
        findMany: jest.Mock;
      };
    };
    insert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    select: jest.Mock;
  };
  var mockedAxios: jest.Mocked<typeof axios>;
}

// Now this will work without the error
global.mockDrizzle = mockDrizzleClient;
