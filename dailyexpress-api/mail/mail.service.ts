import {
  SESv2Client,
  SendEmailCommand,
  type SendEmailCommandOutput,
} from "@aws-sdk/client-sesv2";
import { createServiceError } from "@shared/utils";
import { sentryServer } from "@shared/sentry";
import { getConfig } from "../config/index";

const config = getConfig();

function encodeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function encodeAddress(label: string, email: string): string {
  return `${encodeHeader(label)} <${email}>`;
}

function createRawEmail(input: {
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  const htmlBase64 = Buffer.from(input.html, "utf8").toString("base64");

  const lines = [
    `From: ${encodeAddress("Daily Express", input.from)}`,
    `To: ${input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    htmlBase64,
    "",
  ];

  return Buffer.from(lines.join("\r\n"));
}

export class MailService {
  private sesClient: SESv2Client;
  private fromAddress: string;
  private fromHeader: string;

  constructor() {
    this.fromAddress = config.EMAIL_FROM;
    this.fromHeader = encodeAddress(config.EMAIL_BRAND_NAME, this.fromAddress);
    this.sesClient = new SESv2Client({
      region: config.AWS_REGION,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
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
