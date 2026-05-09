# Auth module scenarios

Module: `dailyexpress-api/auth`

Auth owns users, email verification, password reset, profile updates, provider
links, Google OAuth callback completion, JWT cookie issuance, and account
deletion.

## Main routes

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/resend-otp`
- `POST /api/v1/auth/verify-otp`
- `POST /api/v1/auth/forget-password`
- `POST /api/v1/auth/reset-password/:token`
- `GET /api/v1/auth/profile`
- `PUT /api/v1/auth/profile`
- `DELETE /api/v1/auth/profile`
- `GET /api/v1/auth/google`
- `GET /api/v1/auth/google/callback`
- `GET /api/v1/auth/providers`
- `DELETE /api/v1/auth/providers/:provider`
- `POST /api/v1/auth/password`
- `GET /api/v1/auth/logout`

## Success

- Register checks email uniqueness, hashes the password, creates the user, writes
  an OTP row, and enqueues the verify-OTP email job in the same transaction.
  The controller sets access and refresh cookies and returns the user/tokens.
- Login verifies the password and requires `emailVerified = true`. The
  controller sets access and refresh cookies and returns tokens.
- Verify OTP checks the user, OTP value, and expiry. It marks the user verified,
  deletes the OTP, issues fresh tokens, and sets auth cookies.
- Resend OTP creates or updates the OTP row and enqueues a verify-OTP email job
  in the same transaction.
- Forgot password returns the same public success response whether or not the
  user exists. When the user exists, it marks older unused reset tokens used,
  inserts a new token, and enqueues the reset email in one transaction.
- Reset password validates the hashed token, expiry, and used state. It updates
  the password, invalidates older sessions with `sessionInvalidBefore`, and marks
  unused reset tokens used in one transaction.
- Profile read/update returns the current user data without exposing the stored
  password. Profile updates write directly to the user row.
- Delete account deletes related driver profile/stats if present, then deletes
  the user in the same transaction.
- Provider list/disconnect reads and removes rows from `userProviders`.
  Disconnect is allowed only when the account still has another login method.
- Set password hashes the new password and stores it on the user.
- Logout clears auth cookies and lingering Google OAuth temporary cookies.

## Failure

- Missing or invalid auth context returns `401`.
- Duplicate registration returns `409`.
- Bad login email/password returns `401`.
- Google-only accounts trying password login return `401` with a Google sign-in
  message.
- Unverified login returns `403`.
- Missing user/profile returns `404`.
- Invalid, expired, or used OTP/reset token returns `401`.
- Resend OTP returns `404` for missing user and `400` for already verified user.
- Disconnecting the only login method returns `400`.
- Invalid provider params return `400`.

## Error

- Database, bcrypt, JWT, email rendering, pg-boss enqueue, and OAuth callback
  exceptions bubble through `asyncHandler` to the global error handler.
- If a transaction fails, user/OTP/reset-token/email-job changes inside it roll
  back together.
- Email delivery errors do not happen in the auth request path; they happen later
  in `email.worker.ts` and are retried by pg-boss.
  