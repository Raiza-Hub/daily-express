import axios from "axios";

process.env.NODE_ENV = "test";
process.env.PAYSTACK_SECRET_KEY = "sk_test_paystack_secret";
process.env.PAYSTACK_BASE_URL = "https://api.paystack.co";
process.env.PAYSTACK_TIMEOUT_MS = "15000";
process.env.PAYMENT_DEFAULT_REDIRECT_URL = "http://localhost:3000/payment/return";
process.env.PAYMENT_DEFAULT_CANCEL_URL = "http://localhost:3000/payment/cancelled";
process.env.KAFKA_ENABLED = "true";

const mockDrizzleClient = {
  query: {
    payment: {
      findFirst: jest.fn(),
    },
    paymentWebhook: {
      findFirst: jest.fn(),
    },
  },
  insert: jest.fn(),
  update: jest.fn(),
};

const mockPaystackHttpClient = {
  post: jest.fn(),
  get: jest.fn(),
};

jest.mock("../db/db", () => ({
  db: mockDrizzleClient,
}));

jest.mock("../src/kafka/producer", () => ({
  emitPaymentCompleted: jest.fn(),
  emitPaymentFailed: jest.fn(),
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

beforeEach(() => {
  jest.clearAllMocks();
  mockedAxios.create.mockReturnValue(mockPaystackHttpClient as any);
  (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
});

declare global {
  var mockDrizzle: typeof mockDrizzleClient;
  var mockPaystackHttp: typeof mockPaystackHttpClient;
}

global.mockDrizzle = mockDrizzleClient;
global.mockPaystackHttp = mockPaystackHttpClient;
