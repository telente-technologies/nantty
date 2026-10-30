CREATE TABLE "plan_price_versions" (
    "id" uuid NOT NULL,
    "created_at" timestamptz NOT NULL,
    "plan_code" character varying NOT NULL,
    "country_code" character varying NOT NULL,
    "currency" character varying NOT NULL,
    "monthly_amount_minor" bigint NOT NULL,
    "yearly_amount_minor" bigint NOT NULL DEFAULT 0,
    "ios_monthly_amount_minor" bigint NOT NULL DEFAULT 0,
    "ios_yearly_amount_minor" bigint NOT NULL DEFAULT 0,
    "android_monthly_amount_minor" bigint NOT NULL DEFAULT 0,
    "android_yearly_amount_minor" bigint NOT NULL DEFAULT 0,
    "store_product_ids" jsonb NOT NULL DEFAULT '{}',
    "active" boolean NOT NULL DEFAULT true,
    "effective_from" timestamptz NOT NULL,
    "created_by_staff_id" character varying NOT NULL,
    "change_reason" character varying NOT NULL,
    PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "planpriceversion_plan_country_effective_from" ON "plan_price_versions" ("plan_code", "country_code", "effective_from");
CREATE INDEX "planpriceversion_effective_from" ON "plan_price_versions" ("effective_from");

CREATE FUNCTION reject_plan_price_version_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'plan price versions are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "plan_price_versions_immutable"
BEFORE UPDATE OR DELETE ON "plan_price_versions"
FOR EACH ROW EXECUTE FUNCTION reject_plan_price_version_mutation();

CREATE FUNCTION reject_plan_price_version_truncate() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'plan price versions are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "plan_price_versions_no_truncate"
BEFORE TRUNCATE ON "plan_price_versions"
FOR EACH STATEMENT EXECUTE FUNCTION reject_plan_price_version_truncate();
