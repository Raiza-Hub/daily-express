ALTER TABLE driver ADD COLUMN kyc_id text;

CREATE UNIQUE INDEX driver_kyc_id_active_idx ON driver(kyc_id) WHERE kyc_status = 'active';
