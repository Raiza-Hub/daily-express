import nodemailer, { type Transporter } from "nodemailer";
import { createServiceError } from "@shared/utils";
import { sentryServer } from "@shared/sentry";

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw createServiceError(`${name} is required`, 500);
  }

  return value;
}

export class MailService {
  private transporter: Transporter;
  private fromAddress: string;

  constructor() {
    this.fromAddress = getRequiredEnv("EMAIL_FROM");
    this.transporter = nodemailer.createTransport({
      host: getRequiredEnv("SMTP_HOST"),
      port: Number(getRequiredEnv("SMTP_PORT")),
      secure: false,
      requireTLS: true,
      auth: {
        user: getRequiredEnv("SMTP_USERNAME"),
        pass: getRequiredEnv("SMTP_PASSWORD"),
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    try {
      const info = await this.transporter.sendMail({
        from: `Daily Express <${this.fromAddress}>`,
        to,
        subject,
        html,
      });

      return { id: info.messageId };
    } catch (error: any) {
      sentryServer.captureException(error, "system", {
        action: "send_mail",
      });
      if (error.statusCode) throw error;
      throw createServiceError(error.message || "Failed to send email", 500);
    }
  }
}
