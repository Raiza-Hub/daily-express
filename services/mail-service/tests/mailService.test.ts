const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({
  sendMail: mockSendMail,
}));

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: mockCreateTransport,
  },
}));

// Import MailService after the mock is defined
import { MailService } from "../src/mailService";

describe("MailService", () => {
  let mailService: MailService;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    process.env.EMAIL_FROM = "noreply@dailyexpress.app";
    process.env.SMTP_HOST = "email-smtp.us-east-1.amazonaws.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USERNAME = "smtp-user";
    process.env.SMTP_PASSWORD = "smtp-password";

    mailService = new MailService();
  });

  describe("sendMail", () => {
    it("should successfully send an email", async () => {
      mockSendMail.mockResolvedValueOnce({
        messageId: "ses-message-123",
      });

      const result = await mailService.sendMail(
        "test@example.com",
        "Test Subject",
        "<p>Test HTML</p>"
      );

      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: "email-smtp.us-east-1.amazonaws.com",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: "smtp-user",
          pass: "smtp-password",
        },
      });
      expect(mockSendMail).toHaveBeenCalledWith({
        from: "Daily Express <noreply@dailyexpress.app>",
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
      });
      expect(result).toEqual({ id: "ses-message-123" });
    });

    it("should throw a ServiceError if SMTP sending fails", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("Invalid login"));

      await expect(
        mailService.sendMail("invalid", "Subject", "<p>HTML</p>")
      ).rejects.toMatchObject({
        message: "Invalid login",
        statusCode: 500,
      });
    });

    it("should throw a ServiceError if transport configuration is missing", () => {
      delete process.env.SMTP_HOST;

      expect(() => new MailService()).toThrow(
        expect.objectContaining({
          message: "SMTP_HOST is required",
          statusCode: 500,
        })
      );
    });

    it("should throw a ServiceError if an exception occurs during sending", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        mailService.sendMail("test@example.com", "Subject", "<p>HTML</p>")
      ).rejects.toMatchObject({
        message: "Network error",
        statusCode: 500,
      });
    });
  });
});
