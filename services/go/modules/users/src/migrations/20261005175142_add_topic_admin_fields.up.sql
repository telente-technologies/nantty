-- modify "topics" table
ALTER TABLE "topics" ADD COLUMN "is_trending" boolean NOT NULL DEFAULT false, ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now();
