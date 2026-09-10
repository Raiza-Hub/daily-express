import { AwsClient } from "aws4fetch";
import { getConfig } from "../config/index";
import { logger } from "../utils/logger";
import { getBoss, QUEUES, type EmailSendJobData } from "./boss";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerEmailWorker() {
  const boss = await getBoss();

  await boss.work<EmailSendJobData>(
    QUEUES.EMAIL_SEND,
    {
      batchSize: 1,
      localConcurrency: 5,
      pollingIntervalSeconds: 2,
    },
    async ([job]) => {
      const msg = job.data;
      const to = (msg.to || "").trim().toLowerCase();
      if (!EMAIL_REGEX.test(to)) {
        logger.error("worker.email.invalid_recipient_dropped", { to });
        return;
      }
      await sendEmail({ ...msg, to });
      logger.info("worker.email.sent", { emailName: msg.emailName, to });
    },
  );

  await boss.work<EmailSendJobData>(
    QUEUES.EMAIL_SEND_DLQ,
    async ([job]) => {
      logger.error("worker.email.dlq", {
        jobId: job.id,
        emailName: job.data.emailName,
        to: job.data.to,
      });
    },
  );
}

async function sendEmail(msg: EmailSendJobData): Promise<void> {
  const config = getConfig();
  if (!config.AWS_ACCESS_KEY_ID || !config.AWS_SECRET_ACCESS_KEY) {
    throw new Error("SES credentials not configured");
  }

  const client = new AwsClient({
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    service: "ses",
    region: config.AWS_REGION,
  });

  const body = {
    FromEmailAddress: config.EMAIL_FROM,
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

  const url = `https://email.${config.AWS_REGION}.amazonaws.com/v2/email/outbound-messages`;
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