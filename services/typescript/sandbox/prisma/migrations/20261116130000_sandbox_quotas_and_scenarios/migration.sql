CREATE TABLE sandbox_usage_periods (
    application_id UUID NOT NULL REFERENCES sandbox_applications(id) ON DELETE CASCADE,
    billing_period CHAR(7) NOT NULL,
    messages_sent INTEGER NOT NULL DEFAULT 0 CHECK (messages_sent >= 0),
    requests_count INTEGER NOT NULL DEFAULT 0 CHECK (requests_count >= 0),
    scenarios_run INTEGER NOT NULL DEFAULT 0 CHECK (scenarios_run >= 0),
    quota_limit_messages INTEGER NOT NULL DEFAULT 1000 CHECK (quota_limit_messages >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (application_id, billing_period)
);
