-- Flutterwave is the only payment provider: move existing rows and the column default over.
UPDATE "ad_top_ups" SET "provider" = 'flutterwave' WHERE "provider" <> 'flutterwave';
ALTER TABLE "ad_top_ups" ALTER COLUMN "provider" SET DEFAULT 'flutterwave';
