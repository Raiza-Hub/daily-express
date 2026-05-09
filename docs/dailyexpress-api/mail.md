# Mail module scenarios

Module: `dailyexpress-api/mail`

Mail owns SMTP delivery only. Core modules do not call it directly; they enqueue
email jobs through `workers/jobService.ts`, and `email.worker.ts` calls
`MailService`.

## Success

- `MailService` builds a Nodemailer SMTP transport from environment settings.
- `email.worker.ts` receives `{ to, subject, html }` jobs from `email.send`.
- On success, the worker sends the email and logs completion.

## Failure

- Invalid recipient, rejected SMTP credentials, unreachable SMTP host, or
  provider-side rejection causes `sendMail` to throw.
- The worker logs the failure and rethrows so pg-boss can retry according to
  `email.send` queue settings.
- If retries are exhausted, pg-boss moves the job to `email.send.dlq`.

## Error

- Mail errors do not roll back the original auth/payment transaction because the
  email job was already committed as durable background work.
- Unexpected worker errors are handled by pg-boss retry/DLQ behavior.
