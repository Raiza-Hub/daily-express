export const SITE_NAME = "Daily Express";

export function tripTitle(originTitle?: string): string {
  return originTitle
    ? `Book a trip from ${originTitle} | ${SITE_NAME}`
    : `Book a trip | ${SITE_NAME}`;
}
