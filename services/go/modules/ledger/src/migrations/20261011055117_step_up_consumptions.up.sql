-- create "step_up_consumptions" table
CREATE TABLE "step_up_consumptions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "token_hash" character varying NOT NULL, "staff_id" character varying NOT NULL, "route" character varying NOT NULL DEFAULT '', "expires_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "stepupconsumption_expires_at" to table: "step_up_consumptions"
CREATE INDEX "stepupconsumption_expires_at" ON "step_up_consumptions" ("expires_at");
-- create index "stepupconsumption_token_hash" to table: "step_up_consumptions"
CREATE UNIQUE INDEX "stepupconsumption_token_hash" ON "step_up_consumptions" ("token_hash");
