import { SITE_NAME } from "./brand";

export function tripTitle(originTitle?: string): string {
  return originTitle
    ? `Book a trip from ${originTitle} | ${SITE_NAME}`
    : `Book a trip | ${SITE_NAME}`;
}
