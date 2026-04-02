import { Resend } from "resend";
import { createServiceError } from "@shared/utils";
import type { Consumer } from "kafkajs";

export class MailService {
  private resend: Resend;
  private consumer: Consumer;

  constructor(consumer: Consumer) {
    this.resend = new Resend(process.env.RESEND_API_KEY || "dummy_key");
    this.consumer = consumer;
  }

  async startConsuming() {
    try {
      await this.consumer.run({
        eachMessage: async ({ topic, message }) => {
          const value = message.value?.toString();
          if (!value) return;
          // auth-service sends: { email, subject, text }
          const { email, subject, text } = JSON.parse(value);
          switch (topic) {
            case "user-created":
              await this.sendMailFunction(email, subject, text);
              break;
            case "forgot-password":
              await this.sendMailFunction(email, subject, text);
              break;
            case "driver-created":
              await this.sendMailFunction(email, subject, text);
              break;
          }
          // console.log("Email sent to:", email);
        },
      });
    } catch (error: any) {
      if (error.statusCode) throw error;
      throw createServiceError(
        error.message || "Failed to start consumer",
        500,
      );
    }
  }

  private async sendMailFunction(to: string, subject: string, html: string) {
    try {
      const response = await this.resend.emails.send({
        from: `Daily Express <${process.env.EMAIL_FROM || "onboarding@resend.dev"}>`,
        to,
        subject,
        html,
      });

      if (response.error) {
        throw createServiceError(response.error.message, 400);
      }

      return response.data;
    } catch (error: any) {
      if (error.statusCode) throw error;
      throw createServiceError(error.message || "Failed to send email", 500);
    }
  }
}
