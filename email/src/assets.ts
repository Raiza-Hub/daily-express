import { existsSync } from "node:fs";
import path from "node:path";

export const EMAIL_LOGO_CONTENT_ID = "dailyexpress-email-logo";

export function getEmailLogoAttachmentPath() {
  const candidates = [
    path.resolve(process.cwd(), "email/src/emails/static/email-logo.png"),
    path.resolve(process.cwd(), "../email/src/emails/static/email-logo.png"),
    path.resolve(process.cwd(), "../../email/src/emails/static/email-logo.png"),
  ];

  const logoPath = candidates.find((candidate) => existsSync(candidate));
  return logoPath || candidates[0];
}
