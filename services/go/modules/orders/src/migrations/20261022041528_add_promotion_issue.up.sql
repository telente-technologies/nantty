-- modify "order_groups" table
ALTER TABLE "order_groups" ADD COLUMN "promotion_issue_code" character varying NOT NULL DEFAULT '', ADD COLUMN "promotion_issue_message" character varying NOT NULL DEFAULT '';
