import * as React from "react";
import { render } from "@react-email/render";
import BookingConfirmedEmail from "./emails/BookingConfirmedEmail";
import DriverAssignedEmail from "./emails/DriverAssignedEmail";
import RefundFailedEmail from "./emails/RefundFailedEmail";
import RefundSuccessfulEmail from "./emails/RefundSuccessfulEmail";
import ResetPasswordEmail from "./emails/ResetPasswordEmail";
import VerifyOtpEmail from "./emails/VerifyOtpEmail";
import PayoutFailedEmail from "./emails/PayoutFailedEmail";
import TripCancelledEmail from "./emails/TripCancelledEmail";

export const templates = {
  BookingConfirmedEmail: BookingConfirmedEmail,
  DriverAssignedEmail: DriverAssignedEmail,
  RefundFailedEmail: RefundFailedEmail,
  RefundSuccessfulEmail: RefundSuccessfulEmail,
  ResetPasswordEmail: ResetPasswordEmail,
  VerifyOtpEmail: VerifyOtpEmail,
  PayoutFailedEmail: PayoutFailedEmail,
  TripCancelledEmail: TripCancelledEmail,
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
  const html = await render(
    React.createElement(TemplateComponent as React.FC<any>, props),
  );
  return makeUnique(html);
}

function makeUnique(html: string): string {
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const marker = `<span style="font-size:0;line-height:0;height:0;overflow:hidden;color:#ffffff;opacity:0;mso-hide:all">${token}</span>`;
  return html
    .replace(/<body[^>]*>/, (match) => `${match}${marker}`)
    .replace("</body>", `${marker}</body>`);
}

export function getEmailSubject(
  templateName: string,
  propsJson: string,
): string {
  const props = JSON.parse(propsJson);

  switch (templateName) {
    case "BookingConfirmedEmail":
      return `Booking Confirmed - ${props.pickupTitle} to ${props.dropoffTitle}`;
    case "DriverAssignedEmail":
      return `Driver Assigned - ${props.pickupTitle} to ${props.dropoffTitle}`;
    case "RefundFailedEmail":
      return `Refund could not be completed yet`;
    case "RefundSuccessfulEmail":
      return `Your refund has been processed`;
    case "ResetPasswordEmail":
      return `Reset Password`;
    case "VerifyOtpEmail":
      return `Verify your email`;
    case "PayoutFailedEmail":
      return `Payout Failed - Action Required`;
    case "TripCancelledEmail":
      return `Trip Cancelled - Refund Initiated`;
    default:
      return "Notification from Daily Express";
  }
}

export function isSupportedTemplate(
  templateName: string,
): templateName is TemplateName {
  return templateName in templates;
}
