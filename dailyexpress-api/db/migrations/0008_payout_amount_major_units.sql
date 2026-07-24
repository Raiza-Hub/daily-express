-- Rename payout/earning columns from kobo (minor) to major units (₦).
-- Only renames columns; no data conversion (new codebase, no production data).

ALTER TABLE earning RENAME COLUMN gross_amount_minor TO gross_amount;
ALTER TABLE earning RENAME COLUMN fee_amount_minor TO fee_amount;
ALTER TABLE earning RENAME COLUMN net_amount_minor TO net_amount;
ALTER TABLE payout RENAME COLUMN amount_minor TO amount;
