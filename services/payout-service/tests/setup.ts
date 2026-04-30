import axios from "axios";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  "postgres://postgres:postgres@localhost:5432/daily_express_test";
process.env.KORA_SECRET_KEY = "sk_test_kora_secret";
process.env.KORA_BASE_URL = "https://api.korapay.com";
process.env.KORA_TIMEOUT_MS = "15000";
process.env.KORA_WEBHOOK_SECRET = "kora-webhook-secret";
process.env.INTERNAL_SERVICE_TOKEN = "internal-token";
process.env.PORT = "5006";

const mockDrizzleTransactionClient = {
  update: jest.fn(),
  insert: jest.fn(),
};

const mockDrizzleClient = {
  query: {
    earning: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    payout: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    payoutAttempt: {
      findFirst: jest.fn(),
    },
    payoutRecipient: {
      findFirst: jest.fn(),
    },
    driverPayoutProfile: {
      findFirst: jest.fn(),
    },
    payoutWebhook: {
      findFirst: jest.fn(),
    },
    consumedEvent: {
      findFirst: jest.fn(),
    },
  },
  insert: jest.fn(),
  update: jest.fn(),
  select: jest.fn(),
  execute: jest.fn(),
  transaction: jest.fn(),
};

const mockKoraHttpClient = {
  post: jest.fn(),
  get: jest.fn(),
};

const mockBoss = {
  send: jest.fn(),
  sendAfter: jest.fn(),
  work: jest.fn(),
  onComplete: jest.fn(),
  getQueue: jest.fn(),
  createQueue: jest.fn(),
  updateQueue: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
};

type MockBoss = typeof mockBoss;
type MockDrizzleClient = typeof mockDrizzleClient;
type MockDrizzleTransactionClient = typeof mockDrizzleTransactionClient;
type MockKoraHttpClient = typeof mockKoraHttpClient;
type MockAxios = jest.Mocked<typeof axios>;

jest.mock("../db/db", () => ({
  db: mockDrizzleClient,
}));

jest.mock("../src/queue", () => ({
  boss: mockBoss,
  startBoss: jest.fn(),
  stopBoss: jest.fn(),
}));

jest.mock("../src/kafka/producer", () => ({
  emitDriverBankVerified: jest.fn(),
  emitDriverBankVerificationFailed: jest.fn(),
  emitPayoutCompleted: jest.fn(),
  emitPayoutFailed: jest.fn(),
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
  get: jest.fn(),
  isAxiosError: jest.fn().mockReturnValue(false),
  default: {
    create: jest.fn(),
    get: jest.fn(),
    isAxiosError: jest.fn().mockReturnValue(false),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

beforeEach(() => {
  const mocksToReset = [
    mockDrizzleTransactionClient.update,
    mockDrizzleTransactionClient.insert,
    mockDrizzleClient.insert,
    mockDrizzleClient.update,
    mockDrizzleClient.select,
    mockDrizzleClient.execute,
    mockDrizzleClient.transaction,
    mockKoraHttpClient.post,
    mockKoraHttpClient.get,
    mockBoss.send,
    mockBoss.sendAfter,
    mockBoss.work,
    mockBoss.onComplete,
    mockBoss.getQueue,
    mockBoss.createQueue,
    mockBoss.updateQueue,
    mockBoss.start,
    mockBoss.stop,
    mockedAxios.create,
    mockedAxios.get,
    mockedAxios.isAxiosError as unknown as jest.Mock,
    ...Object.values(mockDrizzleClient.query).flatMap((group) =>
      Object.values(group),
    ),
  ];

  mocksToReset.forEach((mockFn) => mockFn.mockReset());
  mockedAxios.create.mockReturnValue(mockKoraHttpClient as any);
  mockDrizzleClient.transaction.mockImplementation(async (callback) =>
    callback(mockDrizzleTransactionClient),
  );
  (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
});

declare global {
  var mockBoss: MockBoss;
  var mockDrizzle: MockDrizzleClient;
  var mockDrizzleTx: MockDrizzleTransactionClient;
  var mockKoraHttp: MockKoraHttpClient;
  var mockAxios: MockAxios;
}

global.mockBoss = mockBoss;
global.mockDrizzle = mockDrizzleClient;
global.mockDrizzleTx = mockDrizzleTransactionClient;
global.mockKoraHttp = mockKoraHttpClient;
global.mockAxios = mockedAxios;
