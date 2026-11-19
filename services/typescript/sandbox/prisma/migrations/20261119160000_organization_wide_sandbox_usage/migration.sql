CREATE TABLE sandbox_organization_usage_periods (
    organization_id TEXT NOT NULL,
    billing_period CHAR(7) NOT NULL,
    messages_sent INTEGER NOT NULL DEFAULT 0 CHECK (messages_sent >= 0),
    requests_count INTEGER NOT NULL DEFAULT 0 CHECK (requests_count >= 0),
    scenarios_run INTEGER NOT NULL DEFAULT 0 CHECK (scenarios_run >= 0),
    quota_limit_messages INTEGER NOT NULL DEFAULT 1000 CHECK (quota_limit_messages >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, billing_period)
);

INSERT INTO sandbox_organization_usage_periods (
    organization_id, billing_period, messages_sent, requests_count,
    scenarios_run, quota_limit_messages, updated_at
)
SELECT a.organization_id, u.billing_period, SUM(u.messages_sent), SUM(u.requests_count),
       SUM(u.scenarios_run), MIN(u.quota_limit_messages), MAX(u.updated_at)
FROM sandbox_usage_periods u
JOIN sandbox_applications a ON a.id = u.application_id
GROUP BY a.organization_id, u.billing_period;

CREATE FUNCTION sandbox_sync_legacy_application_usage() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    owning_organization TEXT;
    message_delta INTEGER;
    request_delta INTEGER;
    scenario_delta INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    SELECT organization_id INTO owning_organization
    FROM sandbox_applications
    WHERE id = NEW.application_id;
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        message_delta := NEW.messages_sent;
        request_delta := NEW.requests_count;
        scenario_delta := NEW.scenarios_run;
    ELSE
        message_delta := GREATEST(NEW.messages_sent - OLD.messages_sent, 0);
        request_delta := GREATEST(NEW.requests_count - OLD.requests_count, 0);
        scenario_delta := GREATEST(NEW.scenarios_run - OLD.scenarios_run, 0);
    END IF;

    IF message_delta = 0 AND request_delta = 0 AND scenario_delta = 0 THEN
        RETURN NEW;
    END IF;

    INSERT INTO sandbox_organization_usage_periods (
        organization_id, billing_period, messages_sent, requests_count,
        scenarios_run, quota_limit_messages, updated_at
    ) VALUES (
        owning_organization, NEW.billing_period, message_delta, request_delta,
        scenario_delta, NEW.quota_limit_messages, now()
    )
    ON CONFLICT (organization_id, billing_period) DO UPDATE SET
        messages_sent = sandbox_organization_usage_periods.messages_sent + EXCLUDED.messages_sent,
        requests_count = sandbox_organization_usage_periods.requests_count + EXCLUDED.requests_count,
        scenarios_run = sandbox_organization_usage_periods.scenarios_run + EXCLUDED.scenarios_run,
        quota_limit_messages = LEAST(sandbox_organization_usage_periods.quota_limit_messages, EXCLUDED.quota_limit_messages),
        updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER sandbox_legacy_usage_sync
AFTER INSERT OR UPDATE ON sandbox_usage_periods
FOR EACH ROW EXECUTE FUNCTION sandbox_sync_legacy_application_usage();
