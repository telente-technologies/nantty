-- modify "profiles" table
ALTER TABLE "profiles" ADD COLUMN "theme" character varying NOT NULL DEFAULT 'system';
