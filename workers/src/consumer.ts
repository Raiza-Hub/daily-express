import { AwsClient } from "aws4fetch";

export interface Env {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_SERVICE?: string;
  SES_REGION: string;
  EMAIL_FROM: string;
}

export interface EmailMessage {
  emailName: string;
  to: string;
  subject: string;
  html: string;
}

// Recipients are validated before being sent; anything that does not look like
// a single email address is dropped and acknowledged so it never reaches SES.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sendEmail(env: Env, msg: EmailMessage): Promise<void> {
  const accessKeyId = env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey || !env.EMAIL_FROM) {
    throw new Error("SES credentials or EMAIL_FROM not configured");
  }

  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: env.AWS_SERVICE || "ses",
    region: env.SES_REGION,
  });

  const body = {
    FromEmailAddress: env.EMAIL_FROM,
    Destination: { ToAddresses: [msg.to] },
    Content: {
      Simple: {
        Subject: { Data: msg.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: msg.html, Charset: "UTF-8" },
        },
      },
    },
  };

  const url = `https://email.${env.SES_REGION}.amazonaws.com/v2/email/outbound-messages`;
  const res = await client.fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SES SendEmail failed (${res.status}): ${text}`);
  }
}

export default {
  async queue(batch: MessageBatch<EmailMessage>, env: Env, _ctx: ExecutionContext) {
    for (const msg of batch.messages) {
      try {
        const to = (msg.body.to || "").trim().toLowerCase();
        if (!EMAIL_REGEX.test(to)) {
          console.error("dropping invalid recipient", { to });
          msg.ack();
          continue;
        }
        await sendEmail(env, { ...msg.body, to });
        msg.ack();
        console.log("email sent", { emailName: msg.body.emailName, to });
      } catch (err) {
        console.error("email send failed, retrying", {
          emailName: msg.body.emailName,
          to: msg.body.to,
          err: (err as Error).message,
        });
        msg.retry({ delaySeconds: 10 });
      }
    }
  },
};
