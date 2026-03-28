import { Resend } from "resend";
import { createServiceError } from "@shared/utils";

const resend = new Resend(process.env.RESEND_API_KEY || "dummy_key");

export class MailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY || "dummy_key");
  }

  async sendMail(to: string, subject: string, html: string) {
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
