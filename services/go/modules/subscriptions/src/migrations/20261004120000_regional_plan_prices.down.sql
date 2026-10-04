-- reverse: modify "plan_prices" table
ALTER TABLE "plan_prices" DROP COLUMN "store_product_ids", DROP COLUMN "android_yearly_amount_minor", DROP COLUMN "android_monthly_amount_minor", DROP COLUMN "ios_yearly_amount_minor", DROP COLUMN "ios_monthly_amount_minor", DROP COLUMN "yearly_amount_minor";
