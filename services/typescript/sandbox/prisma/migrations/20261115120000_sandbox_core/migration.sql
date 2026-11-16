CREATE TABLE sandbox_applications (
    id UUID PRIMARY KEY,
    organization_id TEXT NOT NULL,
    external_application_id TEXT NOT NULL,
    name VARCHAR(120) NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('active', 'suspended', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, external_application_id)
);

CREATE TABLE sandbox_credentials (
    id UUID PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES sandbox_applications(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    token_prefix VARCHAR(24) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX sandbox_credentials_active_application_idx ON sandbox_credentials(application_id) WHERE revoked_at IS NULL;

CREATE TABLE sandbox_customers (
    id UUID PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES sandbox_applications(id) ON DELETE CASCADE,
    external_reference VARCHAR(128) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (application_id, external_reference),
    UNIQUE (application_id, id)
);

CREATE TABLE sandbox_conversations (
    id UUID PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES sandbox_applications(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (application_id, id),
    FOREIGN KEY (application_id, customer_id) REFERENCES sandbox_customers(application_id, id) ON DELETE CASCADE
);

CREATE TABLE sandbox_messages (
    id UUID PRIMARY KEY,
    application_id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    sender VARCHAR(16) NOT NULL CHECK (sender IN ('business', 'customer')),
    text VARCHAR(4000) NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (
        (sender = 'customer' AND status = 'received') OR
        (sender = 'business' AND status IN ('sent', 'delivered', 'read', 'failed'))
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (application_id, idempotency_key),
    FOREIGN KEY (application_id, conversation_id) REFERENCES sandbox_conversations(application_id, id) ON DELETE CASCADE
);

CREATE INDEX sandbox_messages_conversation_created_idx ON sandbox_messages(application_id, conversation_id, created_at DESC);

CREATE TABLE sandbox_events (
    id UUID PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES sandbox_applications(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    aggregate_id UUID NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sandbox_events_application_created_idx ON sandbox_events(application_id, created_at DESC);

CREATE TABLE sandbox_api_requests (
    request_id VARCHAR(128) PRIMARY KEY,
    application_id UUID REFERENCES sandbox_applications(id) ON DELETE SET NULL,
    method VARCHAR(12) NOT NULL,
    path VARCHAR(512) NOT NULL,
    status_code SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sandbox_api_requests_application_created_idx ON sandbox_api_requests(application_id, created_at DESC);

CREATE TABLE sandbox_control_audit (
    id UUID PRIMARY KEY,
    actor VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    application_id UUID REFERENCES sandbox_applications(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sandbox_webhook_endpoints (
    id UUID PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES sandbox_applications(id) ON DELETE CASCADE,
    url VARCHAR(2048) NOT NULL,
    description VARCHAR(80) NOT NULL DEFAULT '',
    events TEXT[] NOT NULL CHECK (cardinality(events) > 0),
    active BOOLEAN NOT NULL DEFAULT true,
    secret_nonce BYTEA NOT NULL CHECK (octet_length(secret_nonce) = 12),
    secret_ciphertext BYTEA NOT NULL,
    secret_tag BYTEA NOT NULL CHECK (octet_length(secret_tag) = 16),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX sandbox_webhook_endpoints_application_idx
    ON sandbox_webhook_endpoints(application_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE sandbox_webhook_deliveries (
    id UUID PRIMARY KEY,
    endpoint_id UUID NOT NULL REFERENCES sandbox_webhook_endpoints(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES sandbox_events(id) ON DELETE CASCADE,
    status VARCHAR(16) NOT NULL CHECK (status IN ('pending', 'in_flight', 'succeeded', 'failed', 'cancelled')),
    attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_until TIMESTAMPTZ,
    last_http_status SMALLINT,
    last_error_code VARCHAR(40),
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (endpoint_id, event_id)
);

CREATE INDEX sandbox_webhook_deliveries_due_idx
    ON sandbox_webhook_deliveries(available_at, created_at)
    WHERE status IN ('pending', 'in_flight');

CREATE INDEX sandbox_webhook_deliveries_endpoint_idx
    ON sandbox_webhook_deliveries(endpoint_id, created_at DESC);

CREATE TABLE sandbox_webhook_delivery_attempts (
    id UUID PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES sandbox_webhook_deliveries(id) ON DELETE CASCADE,
    attempt_number SMALLINT NOT NULL CHECK (attempt_number > 0),
    outcome VARCHAR(16) NOT NULL CHECK (outcome IN ('started', 'succeeded', 'failed')),
    http_status SMALLINT,
    error_code VARCHAR(40),
    duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    UNIQUE (delivery_id, attempt_number)
);

CREATE INDEX sandbox_webhook_attempts_delivery_idx
    ON sandbox_webhook_delivery_attempts(delivery_id, attempt_number DESC);
