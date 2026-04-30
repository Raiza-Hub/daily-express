import axios from "axios";

process.env.NODE_ENV = "test";
process.env.KORA_SECRET_KEY = "sk_test_kora_secret";
process.env.KORA_WEBHOOK_SECRET = "sk_test_kora_webhook_secret";
process.env.KORA_BASE_URL = "https://api.korapay.com";
process.env.KORA_TIMEOUT_MS = "15000";
process.env.KORA_WEBHOOK_URL =
  "https://daily-express.test/api/payments/v1/payments/webhooks/kora";
process.env.PAYMENT_PUBLIC_BASE_URL = "https://daily-express.test/api/payments";
process.env.FRONTEND_URL = "http://localhost:3000";

const mockDrizzleClient: any = {};

mockDrizzleClient.query = {
  payment: {
    findFirst: jest.fn(),
  },
  paymentWebhook: {
    findFirst: jest.fn(),
  },
  webhookProcessed: {
    findFirst: jest.fn(),
  },
  bookingHold: {
    findFirst: jest.fn(),
  },
  outboxEvents: {
    findFirst: jest.fn(),
  },
};
mockDrizzleClient.insert = jest.fn();
mockDrizzleClient.update = jest.fn();
mockDrizzleClient.delete = jest.fn();
mockDrizzleClient.execute = jest.fn();
mockDrizzleClient.transaction = jest.fn(async (callback: any) =>
  callback(mockDrizzleClient),
);

const mockKoraHttpClient = {
  post: jest.fn(),
  get: jest.fn(),
};

const mockBoss = {
  send: jest.fn(),
  cancel: jest.fn(),
};

type MockBoss = typeof mockBoss;
type MockDrizzle = typeof mockDrizzleClient;
type MockKoraHttp = typeof mockKoraHttpClient;

jest.mock("../db/db", () => ({
  db: mockDrizzleClient,
}));

jest.mock("../src/boss", () => ({
  QUEUES: {
    PAYMENT_EXPIRE: "payment.expire",
    PROCESS_WEBHOOK: "process.webhook",
    PAYMENT_EXPIRE_DLQ: "payment.expire.dlq",
    PROCESS_WEBHOOK_DLQ: "process.webhook.dlq",
  },
  getBoss: jest.fn(async () => mockBoss),
  stopBoss: jest.fn(),
}));

jest.mock("../src/kafka/producer", () => ({
  emitPaymentCompleted: jest.fn(),
  emitPaymentFailed: jest.fn(),
  sendRefundFailedNotification: jest.fn(),
}));

jest.mock("@shared/sentry", () => ({
  sentryServer: {
    captureException: jest.fn(),
    flush: jest.fn(),
    shutdown: jest.fn(),
  },
  initSentry: jest.fn(),
}));

jest.mock("axios", () => ({
  create: jest.fn(),
  isAxiosError: jest.fn().mockReturnValue(false),
  default: {
    create: jest.fn(),
    isAxiosError: jest.fn().mockReturnValue(false),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
mockedAxios.create.mockReturnValue(mockKoraHttpClient as any);
(mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);

beforeEach(() => {
  jest.clearAllMocks();
  global.mockBoss.send.mockReset();
  global.mockBoss.cancel.mockReset();
  global.mockDrizzle.insert.mockReset();
  global.mockDrizzle.update.mockReset();
  global.mockDrizzle.delete.mockReset();
  global.mockDrizzle.execute.mockReset();
  global.mockDrizzle.transaction.mockReset();
  global.mockDrizzle.transaction.mockImplementation(async (callback: any) =>
    callback(global.mockDrizzle),
  );
  global.mockDrizzle.query.payment.findFirst.mockReset();
  global.mockDrizzle.query.paymentWebhook.findFirst.mockReset();
  global.mockDrizzle.query.webhookProcessed.findFirst.mockReset();
  global.mockDrizzle.query.bookingHold.findFirst.mockReset();
  global.mockDrizzle.query.outboxEvents.findFirst.mockReset();
  global.mockKoraHttp.post.mockReset();
  global.mockKoraHttp.get.mockReset();
  mockedAxios.create.mockReturnValue(mockKoraHttpClient as any);
  (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
});

declare global {
  var mockBoss: MockBoss;
  var mockDrizzle: MockDrizzle;
  var mockKoraHttp: MockKoraHttp;
}

global.mockBoss = mockBoss;
global.mockDrizzle = mockDrizzleClient;
global.mockKoraHttp = mockKoraHttpClient;
