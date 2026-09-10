import { jobService, type JobExecutor } from "../workers/job.service";

export type EmailToSend = {
  emailName: string;
  to: string;
  subject: string;
  html: string;
};

export async function enqueueEmail(
  tx: JobExecutor,
  email: EmailToSend,
): Promise<void> {
  await jobService.enqueueEmail(tx, email);
}