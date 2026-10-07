import { createHmac, timingSafeEqual } from "node:crypto";
import { getConfig } from "../config/index";

function callbackSecret(): string {
  const value = getConfig().AFRICASTALKING_CALLBACK_SECRET;
  if (!value) {
    throw new Error("Africa's Talking callback secret is not configured");
  }
  return value;
}

export function createAttemptToken(attemptId: string): string {
  return createHmac("sha256", callbackSecret())
    .update(attemptId)
    .digest("hex");
}

export function verifyAttemptToken(attemptId: string, token: unknown): boolean {
  if (typeof token !== "string") return false;

  let expected: string;
  try {
    expected = createAttemptToken(attemptId);
  } catch {
    return false;
  }

  const supplied = Buffer.from(token);
  const reference = Buffer.from(expected);
  return (
    supplied.length === reference.length && timingSafeEqual(supplied, reference)
  );
}