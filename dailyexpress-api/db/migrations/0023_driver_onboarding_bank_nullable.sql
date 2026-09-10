-- Driver onboard/verification changes.
--
-- Create Driver no longer collects bank details or KYC; verification happens
-- synchronously via the Update API (bank + KYC resolved/verified against Kora at
-- request time). So:
--   * bank details, bank_verification_status, and kyc_status are nullable.
--   * failure reasons are no longer stored (sent back to the frontend instead).
--   * bank_verification_status and kyc_status enums drop 'pending'
--     (statuses are only 'active' | 'failed' | NULL; null = not provided).

ALTER TABLE driver ALTER COLUMN bank_name DROP NOT NULL;
ALTER TABLE driver ALTER COLUMN bank_code DROP NOT NULL;
ALTER TABLE driver ALTER COLUMN account_number DROP NOT NULL;
ALTER TABLE driver ALTER COLUMN account_name DROP NOT NULL;
ALTER TABLE driver ALTER COLUMN bank_verification_status DROP NOT NULL;
ALTER TABLE driver ALTER COLUMN kyc_status DROP NOT NULL;

ALTER TABLE driver DROP COLUMN bank_verification_failure_reason;
ALTER TABLE driver DROP COLUMN kyc_failure_reason;

-- bank_verification_status enum: drop 'pending' (Postgres 18 cannot DROP VALUE; type-swap).
UPDATE driver SET bank_verification_status = NULL WHERE bank_verification_status = 'pending';

CREATE TYPE bank_verification_status_new AS ENUM ('active','failed');
ALTER TABLE driver ALTER COLUMN bank_verification_status DROP DEFAULT;
ALTER TABLE driver ALTER COLUMN bank_verification_status TYPE bank_verification_status_new USING bank_verification_status::text::bank_verification_status_new;
DROP TYPE bank_verification_status;
ALTER TYPE bank_verification_status_new RENAME TO bank_verification_status;

-- kyc_status enum: drop 'none' and 'pending' (type-swap).
UPDATE driver SET kyc_status = NULL WHERE kyc_status IN ('none','pending');

CREATE TYPE kyc_status_new AS ENUM ('active','failed');
ALTER TABLE driver ALTER COLUMN kyc_status DROP DEFAULT;
ALTER TABLE driver ALTER COLUMN kyc_status TYPE kyc_status_new USING kyc_status::text::kyc_status_new;
DROP TYPE kyc_status;
ALTER TYPE kyc_status_new RENAME TO kyc_status;
