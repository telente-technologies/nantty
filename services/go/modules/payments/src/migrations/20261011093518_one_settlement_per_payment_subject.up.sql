-- dedupe before the unique index: keep the earliest settled intent per purpose and subject; flag any other for finance review
UPDATE "payment_intents" AS later SET "failure_reason" = 'duplicateSettlementNeedsReview', "version" = later."version" + 1
FROM "payment_intents" AS earlier
WHERE later."status" = 'succeeded' AND later."failure_reason" NOT LIKE 'duplicate%'
  AND earlier."status" = 'succeeded' AND earlier."failure_reason" NOT LIKE 'duplicate%'
  AND earlier."purpose" = later."purpose" AND earlier."subject_id" = later."subject_id"
  AND (COALESCE(earlier."paid_at", earlier."created_at"), earlier."id") < (COALESCE(later."paid_at", later."created_at"), later."id");
-- create index "payment_intents_one_settlement_per_subject" to table: "payment_intents"
CREATE UNIQUE INDEX "payment_intents_one_settlement_per_subject" ON "payment_intents" ("purpose", "subject_id") WHERE (((status)::text = 'succeeded'::text) AND ((failure_reason)::text !~~ 'duplicate%'::text));
