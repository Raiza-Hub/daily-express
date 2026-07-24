import { readFileSync } from "node:fs";
import {
  SESv2Client,
  SendEmailCommand,
  type SendEmailCommandOutput,
} from "@aws-sdk/client-sesv2";
import { createServiceError } from "@shared/utils";
import { sentryServer } from "@shared/sentry";
import {
  EMAIL_LOGO_CONTENT_ID,
  getEmailLogoAttachmentPath,
} from "@repo/email";

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw createServiceError(`${name} is required`, 500);
  }

  return value;
}

function getOptionalEnv(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function encodeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function encodeAddress(label: string, email: string): string {
  return `${encodeHeader(label)} <${email}>`;
}

function createBoundary(label: string): string {
  return `dailyexpress-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createRawEmail(input: {
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  const boundary = createBoundary("related");
  const logoBase64 = readFileSync(getEmailLogoAttachmentPath()).toString("base64");
  const htmlBase64 = Buffer.from(input.html, "utf8").toString("base64");

  const lines = [
    `From: ${encodeAddress("Daily Express", input.from)}`,
    `To: ${input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/related; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    htmlBase64,
    "",
    `--${boundary}`,
    'Content-Type: image/png; name="email-logo.png"',
    "Content-Transfer-Encoding: base64",
    `Content-ID: <${EMAIL_LOGO_CONTENT_ID}>`,
    'Content-Disposition: inline; filename="email-logo.png"',
    "",
    logoBase64,
    "",
    `--${boundary}--`,
    "",
  ];

  return Buffer.from(lines.join("\r\n"));
}

export class MailService {
  private sesClient: SESv2Client;
  private fromAddress: string;
  private fromHeader: string;

  constructor() {
    this.fromAddress = getRequiredEnv("EMAIL_FROM");
    this.fromHeader = encodeAddress(
      getOptionalEnv("EMAIL_BRAND_NAME", "Daily Express"),
      this.fromAddress,
    );
    this.sesClient = new SESv2Client({
      region: getRequiredEnv("AWS_REGION"),
      credentials: {
        accessKeyId: getRequiredEnv("AWS_ACCESS_KEY_ID"),
        secretAccessKey: getRequiredEnv("AWS_SECRET_ACCESS_KEY"),
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      throw createServiceError("Invalid recipient email address", 400);
    }

    try {
      const info: SendEmailCommandOutput = await this.sesClient.send(
        new SendEmailCommand({
          FromEmailAddress: this.fromHeader,
          Destination: {
            ToAddresses: [to],
          },
          Content: {
            Raw: {
              Data: createRawEmail({
                from: this.fromAddress,
                to,
                subject,
                html,
              }),
            },
          },
        }),
      );

      return { id: info.MessageId };
    } catch (error: any) {
      sentryServer.captureException(error, "system", {
        action: "send_mail",
      });
      if (error.statusCode) throw error;
      throw createServiceError(error.message || "Failed to send email", 500);
    }
  }
}
