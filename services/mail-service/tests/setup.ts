import dotenv from "dotenv";

// Load environment variables for tests
dotenv.config();

// Mock Resend before running tests
jest.mock("resend", () => {
  return {
    Resend: jest.fn().mockImplementation(() => {
      return {
        emails: {
          send: jest.fn(),
        },
      };
    }),
  };
});
