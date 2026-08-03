-- Drop raw provider response audit columns from payout.
-- They were written but never read; removing reduces stored payload size.

ALTER TABLE payout
  DROP COLUMN raw_initiate_response,
  DROP COLUMN raw_final_status_response;