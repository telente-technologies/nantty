-- modify "shipping_addresses" table
ALTER TABLE "shipping_addresses" ALTER COLUMN "phone" SET DEFAULT '', ADD COLUMN "phone_sealed" bytea NULL;
DO $$
DECLARE address_reader text;
BEGIN
  FOREACH address_reader IN ARRAY ARRAY['svc_orders', 'svc_commerce'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = address_reader) AND pg_has_role(address_reader, 'zudomart_readers', 'MEMBER') THEN
      EXECUTE format('GRANT SELECT ("phone_sealed") ON "shipping_addresses" TO %I', address_reader);
    END IF;
  END LOOP;
END $$;
