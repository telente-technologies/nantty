-- modify "escrows" table
ALTER TABLE "escrows" ADD COLUMN "custody" character varying NOT NULL DEFAULT 'sellerEscrow';
