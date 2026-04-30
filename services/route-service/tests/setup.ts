import { JWTPayload } from "@shared/types";

process.env.NODE_ENV = "test";
process.env.ROUTE_SERVICE_TIMEZONE = "Africa/Lagos";

export const testGatewayUser: JWTPayload = {
  userId: "test-user-id",
  email: "test@dailyexpress.app",
  emailVerified: true,
};

export const testDriverIdentity = {
  driverId: "test-driver-id",
  userId: "test-user-id",
  firstName: "Tunde",
  lastName: "Driver",
  phone: "08000000000",
  profilePictureUrl: null,
  country: "Nigeria",
  state: "Lagos",
  isActive: true,
  sourceOccurredAt: new Date("2025-07-01T00:00:00Z"),
  createdAt: new Date("2025-07-01T00:00:00Z"),
  updatedAt: new Date("2025-07-01T00:00:00Z"),
};

export const testPassengerIdentity = {
  userId: "user-1",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  sourceOccurredAt: new Date("2025-07-01T00:00:00Z"),
  createdAt: new Date("2025-07-01T00:00:00Z"),
  updatedAt: new Date("2025-07-01T00:00:00Z"),
};

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
  vehicleType: "bus" as const,
  meeting_point: "Main Park",
  availableSeats: 14,
  price: 13000,
  departure_time: new Date("2025-07-01T08:00:00Z"),
  arrival_time: new Date("2025-07-01T13:00:00Z"),
  status: "active" as const,
  createdAt: new Date("2025-07-01T00:00:00Z"),
  updatedAt: new Date("2025-07-01T00:00:00Z"),
};

function createSelectQueryChain(): any {
  const chain: any = {
    where: jest.fn(() => chain),
    orderBy: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    offset: jest.fn(() => chain),
    then: (
      onFulfilled: (value: any) => any,
      onRejected?: (reason: any) => any,
    ) => Promise.resolve(global.mockSelectResult).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: any) => any) =>
      Promise.resolve(global.mockSelectResult).catch(onRejected),
    finally: (onFinally?: (() => void) | undefined) =>
      Promise.resolve(global.mockSelectResult).finally(onFinally),
  };

  return chain;
}

function createSelectFromChain(): any {
  const queryChain = createSelectQueryChain();

  return {
    where: jest.fn(() => queryChain),
    groupBy: jest.fn(() => queryChain),
  };
}

function createInsertChain() {
  return {
    values: jest.fn().mockReturnThis(),
    onConflictDoNothing: jest.fn().mockReturnThis(),
    onConflictDoUpdate: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
  };
}

function createUpdateChain() {
  return {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
  };
}

function createDeleteChain() {
  return {
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
  };
}

const mockDrizzleClient: any = {
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
    driverIdentity: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    passengerIdentity: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    consumedEvent: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  transaction: jest.fn(),
};

function resetDrizzleBaseMocks() {
  mockDrizzleClient.select.mockReset();
  mockDrizzleClient.select.mockImplementation(() => ({
    from: jest.fn(() => createSelectFromChain()),
  }));

  mockDrizzleClient.insert.mockReset();
  mockDrizzleClient.insert.mockImplementation(() => createInsertChain());

  mockDrizzleClient.update.mockReset();
  mockDrizzleClient.update.mockImplementation(() => createUpdateChain());

  mockDrizzleClient.delete.mockReset();
  mockDrizzleClient.delete.mockImplementation(() => createDeleteChain());

  mockDrizzleClient.transaction.mockReset();
  mockDrizzleClient.transaction.mockImplementation(async (callback: any) =>
    callback(mockDrizzleClient),
  );
}

resetDrizzleBaseMocks();

jest.mock("../db/db", () => ({
  db: mockDrizzleClient,
}));

jest.mock("../src/kafka/producer", () => ({
  emitBookingCancelled: jest.fn(),
  emitBookingConfirmed: jest.fn(),
  emitBookingCreated: jest.fn(),
  emitRouteCreated: jest.fn(),
  emitRouteDeleted: jest.fn(),
  emitTripCancelled: jest.fn(),
  emitTripCompleted: jest.fn(),
  sendBookingNotification: jest.fn(),
}));

(global as any).mockDrizzle = mockDrizzleClient;

beforeEach(() => {
  jest.clearAllMocks();
  resetDrizzleBaseMocks();
  global.mockSelectResult = [];
  global.mockDrizzle.query.driverIdentity.findFirst.mockResolvedValue(
    testDriverIdentity,
  );
  global.mockDrizzle.query.driverIdentity.findMany.mockResolvedValue([
    testDriverIdentity,
  ]);
  global.mockDrizzle.query.passengerIdentity.findFirst.mockResolvedValue(
    testPassengerIdentity,
  );
  global.mockDrizzle.query.passengerIdentity.findMany.mockResolvedValue([
    testPassengerIdentity,
  ]);
  global.mockDrizzle.query.consumedEvent.findFirst.mockResolvedValue(null);
});

declare global {
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
      driverIdentity: {
        findFirst: jest.Mock;
        findMany: jest.Mock;
      };
      passengerIdentity: {
        findFirst: jest.Mock;
        findMany: jest.Mock;
      };
      consumedEvent: {
        findFirst: jest.Mock;
        findMany: jest.Mock;
      };
    };
    insert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    select: jest.Mock;
    transaction: jest.Mock;
  };
  var mockSelectResult: any;
}

global.mockSelectResult = [];
