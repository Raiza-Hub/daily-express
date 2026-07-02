import { getBoss, QUEUES } from "./boss";
import { MailService } from "../mail/mail.service";
import { logger } from "../utils/logger";

const mailService = new MailService();

export type EmailJobData = {
  emailName?: string;
  to: string;
  subject: string;
  html: string;
};

export async function registerEmailWorker() {
  const boss = await getBoss();

  await boss.work<EmailJobData>(
    QUEUES.EMAIL_SEND,
    {
      batchSize: 1,
      localConcurrency: 5,
      pollingIntervalSeconds: 2,
      heartbeatRefreshSeconds: 30,
    },
    async ([job]) => {
      logger.info("worker.email.started", { jobId: job.id, to: job.data.to });
      try {
        await mailService.sendMail(job.data.to, job.data.subject, job.data.html);
        logger.info("worker.email.completed", { jobId: job.id });
      } catch (error) {
        logger.error("worker.email.failed", {
          jobId: job.id,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  );
}
