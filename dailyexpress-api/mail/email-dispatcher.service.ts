import { getConfig } from "../config";
import { logger } from "../utils/logger";

export type EmailToSend = {
  emailName: string;
  to: string;
  subject: string;
  html: string;
};

const API = "https://api.cloudflare.com/client/v4";

async function pushMessages(messages: Array<EmailToSend>): Promise<void> {
  const config = getConfig();
  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_EMAIL_QUEUE_ID, CLOUDFLARE_API_TOKEN } =
    config;
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_EMAIL_QUEUE_ID || !CLOUDFLARE_API_TOKEN) {
    logger.error("email_dispatcher.misconfigured", {
      reason: "Cloudflare Queues env vars missing",
    });
    return;
  }

  const res = await fetch(
    `${API}/accounts/${CLOUDFLARE_ACCOUNT_ID}/queues/${CLOUDFLARE_EMAIL_QUEUE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: messages.map((m) => ({ body: m })) }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    logger.error("email_dispatcher.push_failed", {
      status: res.status,
      body: text,
    });
  }
}

export async function sendEmailToQueue(email: EmailToSend): Promise<void> {
  await pushMessages([email]);
}
