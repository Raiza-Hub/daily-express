const mockSend = jest.fn();

jest.mock("resend", () => {
  return {
    Resend: jest.fn().mockImplementation(() => {
      return {
        emails: {
          send: mockSend,
        },
      };
    }),
  };
});

// Import MailService after the mock is defined
import { MailService } from "../src/mailService";

describe("MailService", () => {
  let mailService: MailService;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    mailService = new MailService();
  });

  describe("sendMail", () => {
    it("should successfully send an email", async () => {
      // Mock successful response
      mockSend.mockResolvedValueOnce({
        data: { id: "resend_123" },
        error: null,
      });

      const result = await mailService.sendMail(
        "test@example.com",
        "Test Subject",
        "<p>Test HTML</p>"
      );

      expect(mockSend).toHaveBeenCalledWith({
        from: "Daily Express <onboarding@resend.dev>",
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
      });
      expect(result).toEqual({ id: "resend_123" });
    });

    it("should throw a ServiceError if Resend returns an error", async () => {
      // Mock Resend returning an error object
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "Invalid email" },
      });

      await expect(
        mailService.sendMail("invalid", "Subject", "<p>HTML</p>")
      ).rejects.toMatchObject({
        message: "Invalid email",
        statusCode: 400,
      });
    });

    it("should throw a ServiceError if an exception occurs during sending", async () => {
      // Mock Resend throwing an exception
      mockSend.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        mailService.sendMail("test@example.com", "Subject", "<p>HTML</p>")
      ).rejects.toMatchObject({
        message: "Network error",
        statusCode: 500,
      });
    });
  });
});
