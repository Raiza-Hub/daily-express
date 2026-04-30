process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/test";
process.env.VAPID_PUBLIC_KEY ||= "test-vapid-public-key";
process.env.VAPID_PRIVATE_KEY ||= "test-vapid-private-key";
process.env.VAPID_SUBJECT ||= "mailto:test@example.com";
process.env.NOTIFICATION_UPSTASH_REDIS_REST_URL ||= "https://test-upstash.example.com";
process.env.NOTIFICATION_UPSTASH_REDIS_REST_TOKEN ||= "test-upstash-token";

export {};

const insertConflictMock = {
  onConflictDoNothing: jest.fn(),
  onConflictDoUpdate: jest.fn(),
  returning: jest.fn(),
};
const valuesMock = jest.fn().mockImplementation((values) => {
  insertConflictMock.returning.mockResolvedValue([
    {
      id: "notif-created-1",
      readAt: null,
      archivedAt: null,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:00:00.000Z"),
      ...(Array.isArray(values) ? values[0] : values),
    },
  ]);

  return insertConflictMock;
});

const mockDrizzleClient: any = {
  query: {
    driverIdentity: {
      findFirst: jest.fn(),
    },
    notification: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    pushSubscription: {
      findMany: jest.fn(),
    },
    consumedEvent: {
      findFirst: jest.fn(),
    },
  },
  insert: jest.fn(() => ({
    values: valuesMock,
  })),
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn().mockResolvedValue([]),
    })),
  })),
  delete: jest.fn(() => ({
    where: jest.fn(),
  })),
  update: jest.fn(() => ({
    set: jest.fn(() => ({
      where: jest.fn(),
      returning: jest.fn(),
    })),
  })),
  transaction: jest.fn(async (callback: any): Promise<any> => callback(mockDrizzleClient)),
};

const mockWebPushClient = {
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
};

type MockRealtimePublisher = {
  publishCreatedNotificationRealtimeEvent: jest.Mock;
  publishReadNotificationRealtimeEvent: jest.Mock;
  publishReadAllNotificationsRealtimeEvent: jest.Mock;
};

type MockBossModule = {
  getBoss: jest.Mock;
  stopBoss: jest.Mock;
  enqueueDispatchNotificationJob: jest.Mock;
  enqueueNotificationEventJob: jest.Mock;
  enqueuePushDeliveryJob: jest.Mock;
  enqueueRealtimeDeliveryJob: jest.Mock;
};

type MockBoss = {
  createQueue: jest.Mock;
  on: jest.Mock;
  send: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
  work: jest.Mock;
};

const mockRealtimePublisher: MockRealtimePublisher = {
  publishCreatedNotificationRealtimeEvent: jest.fn(),
  publishReadNotificationRealtimeEvent: jest.fn(),
  publishReadAllNotificationsRealtimeEvent: jest.fn(),
};

const mockBoss: MockBoss = {
  createQueue: jest.fn(),
  on: jest.fn(),
  send: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  work: jest.fn(),
};

const mockBossModule: MockBossModule = {
  getBoss: jest.fn().mockResolvedValue(mockBoss),
  stopBoss: jest.fn(),
  enqueueDispatchNotificationJob: jest.fn(),
  enqueueNotificationEventJob: jest.fn(),
  enqueuePushDeliveryJob: jest.fn(),
  enqueueRealtimeDeliveryJob: jest.fn(),
};

jest.mock("../db/db", () => ({
  db: mockDrizzleClient,
}));

jest.mock("web-push", () => ({
  __esModule: true,
  default: mockWebPushClient,
}));

jest.mock("../src/realtime/publisher", () => mockRealtimePublisher);
jest.mock("../src/boss", () => ({
  QUEUES: {
    PROCESS_NOTIFICATION_EVENT: "notification.process.event",
    PROCESS_NOTIFICATION_EVENT_DLQ: "notification.process.event.dlq",
    DISPATCH_NOTIFICATION: "notification.dispatch",
    DISPATCH_NOTIFICATION_DLQ: "notification.dispatch.dlq",
    DELIVER_PUSH: "notification.deliver.push",
    DELIVER_PUSH_DLQ: "notification.deliver.push.dlq",
    DELIVER_REALTIME: "notification.deliver.realtime",
    DELIVER_REALTIME_DLQ: "notification.deliver.realtime.dlq",
  },
  ...mockBossModule,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockDrizzleClient.transaction.mockImplementation(async (callback: any) =>
    callback(mockDrizzleClient),
  );
  mockBossModule.getBoss.mockResolvedValue(mockBoss);
  mockDrizzleClient.query.driverIdentity.findFirst.mockResolvedValue(null);
  mockDrizzleClient.query.pushSubscription.findMany.mockResolvedValue([]);
});

declare global {
  var mockDrizzle: typeof mockDrizzleClient;
  var mockNotificationValues: typeof valuesMock;
  var mockNotificationInsertConflict: typeof insertConflictMock;
  var mockWebPush: typeof mockWebPushClient;
  var mockRealtimePublisher: MockRealtimePublisher;
  var mockBoss: MockBoss;
  var mockBossModule: MockBossModule;
}

global.mockDrizzle = mockDrizzleClient;
global.mockNotificationValues = valuesMock;
global.mockNotificationInsertConflict = insertConflictMock;
global.mockWebPush = mockWebPushClient;
global.mockRealtimePublisher = mockRealtimePublisher;
global.mockBoss = mockBoss;
global.mockBossModule = mockBossModule;
