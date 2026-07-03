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

/**
 * Returns the logo src for use in email templates.
 * - In the React Email preview server (NODE_ENV !== "production"), uses the
 *   static file URL served by `email dev` so the logo is visible in the browser.
 * - In production, uses a CID reference so the logo is embedded as an inline
 *   attachment in the actual sent email.
 */
export function getEmailLogoSrc() {
  if (process.env.NODE_ENV !== "production") {
    return "/static/email-logo.png";
  }
  return `cid:${EMAIL_LOGO_CONTENT_ID}`;
}
