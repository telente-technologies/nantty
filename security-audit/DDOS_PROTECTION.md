# Availability and DDoS resilience

## Observed controls

- Gateway has global request limits plus named per-route limits (auth, OTP/reset/signup, upload, search, financial/team writes, messaging, reporting and other operations).
- Shared Valkey provides cross-instance counters in normal operation. On errors, a short circuit uses in-memory counters; this avoids immediate total service failure but limits are then per-process and can be multiplied by replica count.
- Gateway config requires Valkey outside development, uses a 1 MiB default body cap, Fastify body limits, bounded upstream timeout and 2–5 second limits on selected internal/provider calls.
- Upload purposes define maximum sizes/durations and short-lived upload URLs; incomplete upload sessions are swept/aborted.
- Terraform includes CloudFront WAF managed rules/rate rules, ALB protections and service/task scaling. These were inspected statically; no AWS state or WAF deployment was queried.

## Gaps / operational questions

- Valkey outage fallback can weaken aggregate rate limiting during a distributed attack; alert on fallback and test multi-instance behavior before launch.
- Route limits do not substitute for provider-level throttles, account-level abuse detection, queue backpressure or cost ceilings on AI/search/transcoding.
- No bounded load, slow-client, queue-saturation, connection-pool or cache-stampede test was run.
- WAF rules, thresholds, logging/redaction, CloudFront attachment and current AWS deployment state are unverified.
- Confirm per-route high-cost budgets, retry ceilings, circuit breakers, graceful overload responses, websocket limits and abuse monitoring.

## Safe next test

Only on isolated loopback stack: 1–5 requests/second per synthetic client, concurrency <= 10, maximum 60 seconds; test one endpoint at a time; abort on CPU/memory/DB pool alerts or unexpected external egress. Never use public endpoints or distributed generators.
