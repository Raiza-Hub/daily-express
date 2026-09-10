-- Google-only auth + profile onboarding.
--
-- Email/password auth (register, login, OTP, password reset, set-password,
-- provider disconnect) has been removed. Google OAuth is the only sign-up
-- path, and a profile-complete endpoint collects phone + date of birth +
-- gender. So:
--   * users gains nullable `phone` (unique where not null) and `gender`.
--   * password-based auth is dropped entirely:
--       - `otp` table removed.
--       - `password_reset_tokens` table removed.
--       - `users.password` removed.
--       - `users.session_invalid_before` removed (logout no longer
--         invalidates sessions server-side).

-- Onboarding fields
ALTER TABLE "users" ADD COLUMN "phone" text;
ALTER TABLE "users" ADD COLUMN "gender" text;
CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_unique_idx"
  ON "users" ("phone") WHERE "phone" IS NOT NULL;

-- Drop password/OTP/session-auth remnants
DROP TABLE IF EXISTS "password_reset_tokens";
DROP TABLE IF EXISTS "otp";
ALTER TABLE "users" DROP COLUMN IF EXISTS "password";
ALTER TABLE "users" DROP COLUMN IF EXISTS "session_invalid_before";