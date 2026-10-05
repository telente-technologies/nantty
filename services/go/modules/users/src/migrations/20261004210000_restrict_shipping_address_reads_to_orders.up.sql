DO $$
DECLARE address_reader text;
BEGIN
  FOREACH address_reader IN ARRAY ARRAY['svc_orders', 'svc_commerce'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = address_reader) AND pg_has_role(address_reader, 'zudomart_readers', 'MEMBER') THEN
      EXECUTE format('GRANT SELECT ("id", "account_id", "recipient_name", "phone", "line1", "line2", "postal_code", "details", "country_code", "region_id", "admin_area_id", "city_id", "free_text_city", "free_text_state") ON "shipping_addresses" TO %I', address_reader);
    END IF;
  END LOOP;
END $$;
REVOKE SELECT ON "shipping_addresses" FROM zudomart_readers;
