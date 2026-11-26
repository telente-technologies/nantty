ALTER TABLE developer_applications
  ADD COLUMN redirect_uris jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(redirect_uris) = 'array');
