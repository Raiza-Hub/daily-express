const defaultProductionLogoUrl = "https://dailyexpress.app/email-logo-v2.png";

/**
 * Returns the logo src for use in email templates.
 * - In the React Email preview server (NODE_ENV !== "production"), uses the
 *   static file URL served by `email dev` so the logo is visible in the browser.
 * - In production, uses an HTTPS-hosted image so mail clients can proxy/cache it
 *   without showing the logo as an inline attachment.
 */
export function getEmailLogoSrc() {
  if (process.env.NODE_ENV !== "production") {
    return "/static/email-logo.png";
  }

  return process.env.EMAIL_LOGO_URL || defaultProductionLogoUrl;
}
