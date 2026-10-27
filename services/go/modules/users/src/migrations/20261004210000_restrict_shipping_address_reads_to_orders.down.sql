GRANT SELECT ("id", "account_id", "recipient_name", "phone", "line1", "line2", "postal_code", "details", "country_code", "region_id", "admin_area_id", "city_id", "free_text_city", "free_text_state") ON "shipping_addresses" TO nantty_readers;
DO $$
DECLARE address_reader text;
BEGIN
  FOREACH address_reader IN ARRAY ARRAY['svc_orders', 'svc_commerce'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = address_reader) THEN
      EXECUTE format('REVOKE SELECT ON "shipping_addresses" FROM %I', address_reader);
    END IF;
  END LOOP;
END $$;
