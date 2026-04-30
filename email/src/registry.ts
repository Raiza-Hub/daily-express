import * as React from "react";
import { render } from "@react-email/render";
import BookingConfirmedEmail from "./emails/BookingConfirmedEmail";
import RefundFailedEmail from "./emails/RefundFailedEmail";
import ResetPasswordEmail from "./emails/ResetPasswordEmail";
import VerifyOtpEmail from "./emails/VerifyOtpEmail";
import PayoutFailedEmail from "./emails/PayoutFailedEmail";

export const templates = {
  BookingConfirmedEmail: BookingConfirmedEmail,
  RefundFailedEmail: RefundFailedEmail,
  ResetPasswordEmail: ResetPasswordEmail,
  VerifyOtpEmail: VerifyOtpEmail,
  PayoutFailedEmail: PayoutFailedEmail,
} as const;

export type TemplateName = keyof typeof templates;

export async function renderEmail(
  templateName: string,
  propsJson: string,
): Promise<string> {
  const props = JSON.parse(propsJson);
  const TemplateComponent = templates[templateName as TemplateName];
  if (!TemplateComponent) {
    throw new Error(`Template ${templateName} not found`);
  }
  return render(React.createElement(TemplateComponent as React.FC<any>, props));
}

export function getEmailSubject(
  templateName: string,
  propsJson: string,
): string {
  const props = JSON.parse(propsJson);
  switch (templateName) {
    case "BookingConfirmedEmail":
      return `Booking Confirmed - ${props.pickupTitle} to ${props.dropoffTitle}`;
    case "RefundFailedEmail":
      return `Refund could not be completed yet`;
    case "ResetPasswordEmail":
      return `Reset Password`;
    case "VerifyOtpEmail":
      return `Verify your email`;
    case "PayoutFailedEmail":
      return `Payout Failed - Action Required`;
    default:
      return "Notification from Daily Express";
  }
}

export function isSupportedTemplate(
  templateName: string,
): templateName is TemplateName {
  return templateName in templates;
}
