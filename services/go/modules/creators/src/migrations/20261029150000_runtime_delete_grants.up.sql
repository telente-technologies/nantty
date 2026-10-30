DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'svc_money') THEN
    GRANT DELETE ON creator_brand_deals TO svc_money;
  END IF;
END
$$;
