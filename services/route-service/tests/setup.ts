import { JWTPayload } from "@shared/types";
import axios from "axios";
import { route } from "db/schema";

// Mock environment variables
process.env.AUTH_SERVICE_URL = "http://localhost:3001";
process.env.NODE_ENV = "test";

export const testRoute = {
  id: "test-route-id",
  driverId: "test-driver-id",
  pickup_location_title: "Ogun State",
  pickup_location_locality: "Ogun State",
  pickup_location_label: "Ogun State",
  dropoff_location_title: "Funnaab",
  dropoff_location_locality: "Funnaab",
  dropoff_location_label: "Funnaab",
  intermediate_stops_title: "Olurisho Street",
  intermediate_stops_locality: "Olurisho Street",
  intermediate_stops_label: "Olurisho Street",
  vehicleType: "bus" as "car" | "bus" | "luxury_car",
  availableSeats: 14,
  price: 13000,
  departure_time: new Date("2025-07-01T00:00:00Z"),
  arrival_time: new Date("2025-07-01T00:00:00Z"),
  status: "active",
  createdAt: new Date("2025-07-01T00:00:00Z"),
  updatedAt: new Date("2025-07-01T00:00:00Z"),
};

// setup.ts
const mockDrizzleClient = {
  query: {
    route: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    trip: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    booking: {
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
  update: jest.fn().mockReturnValue({
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([testRoute]),
  }),
  delete: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(), // This allows .where() to be called
  }),
};

// //Mock the database module
// jest.mock("../src/database", () => mockDrizzleClient);

// Properly mock the named export 'db' from your db module
jest.mock("../db/db", () => ({
  db: mockDrizzleClient,
}));

//mock axios for authClient
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
  isAxiosError: jest.fn().mockReturnValue(false),
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

export const testUpdateRouteRequest = {
  driverId: "test-driver-id",
  pickup_location_title: "Ogun State",
  pickup_location_locality: "Ogun State",
  pickup_location_label: "Ogun State",
  dropoff_location_title: "Funnaab",
  dropoff_location_locality: "Funnaab",
  dropoff_location_label: "Funnaab",
  intermediate_stops_title: "Olurisho Road",
  intermediate_stops_locality: "Olurisho Road",
  intermediate_stops_label: "Olurisho Road",
  price: 12000,
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
  Object.values(mockDrizzleClient.query.route).forEach((mock) => {
    if (typeof mock === "function" && "mockReset" in mock) {
      (mock as jest.Mock).mockReset();
    }
  });
  Object.values(mockDrizzleClient.query.trip).forEach((mock) => {
    if (typeof mock === "function" && "mockReset" in mock) {
      (mock as jest.Mock).mockReset();
    }
  });
  Object.values(mockDrizzleClient.query.booking).forEach((mock) => {
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
  // Changing this to 'any' or a more flexible type
  // prevents the 'never' conflict across all test files
  var mockDrizzle: {
    query: {
      route: {
        findFirst: jest.Mock;
        findMany: jest.Mock;
      };
      trip: {
        findFirst: jest.Mock;
        findMany: jest.Mock;
      };
      booking: {
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
