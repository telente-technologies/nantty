# Bounded load test results

Date: 2026-10-29.

## Bounded request-burst check

Added and executed a bounded in-process gateway HTTP test: 20 concurrent GET requests to a fake-upstream feed route, with the configured global limit set to 5/minute. Exactly 5 returned 200 and 15 returned 429. The Vitest file completed successfully (21 tests). This confirms the global rate limiter's burst behavior for a small synthetic request set.

This is not a throughput/load benchmark. It collected no request latency percentiles, CPU/RSS, open DB connections, queue depth, or recovery measurements. The executed ledger concurrency tests (40 concurrent spends, 20 duplicate-reference operations, 72 concurrent gift entries) are documented in `CONCURRENCY_TEST_RESULTS.md`; they validate accounting behavior, not throughput or DoS resilience.

No live service stack was loaded. The normal launcher reuses the existing development Postgres and fixed local service ports; there is no independent disposable full-stack configuration with synthetic service credentials available. Avoiding those shared resources was intentional.

## Current-source bounded rerun — 2026-10-29

The seven gateway HTTP suites were rerun and passed **1,474 tests**. The included synthetic 20-request concurrent feed burst still produced 5 HTTP 200 and 15 HTTP 429 responses at the configured limit of 5/minute. This validates the small burst/rate-limit invariant only. The run collected no p50/p95/p99 latency, throughput, CPU/RSS, DB pool saturation, queue depth or recovery metrics. The workspace warned that local Node `24.19.0` is below its declared `>=24.22.1` minimum; Fastify emitted `FSTWRN004` about error-handler override, but the tests passed.

No new load was applied to the shared development stack. A full bounded capacity/soak run remains blocked on an isolated compose profile with synthetic credentials and separate disposable DB, Valkey, and broker services.

## Safe test plan when isolation exists

- Use a separate compose project, uniquely named containers/volumes, disposable DB/Valkey/RabbitMQ, loopback-only ports and mock providers.
- Start at 1 request/second, then 5; concurrency cap 10; one route at a time; maximum 60 seconds. Ensure an explicit cancel/abort path.
- Record p50/p95/p99, errors, CPU, RSS, open DB connections, queue depth and recovery time. Abort at CPU >70% sustained for 15 seconds, memory >75% of the configured container limit, DB pool >80%, queue growth without drain for 15 seconds, or any unexpected external request.
- Exercise rate-limit onset/recovery, slow request timeouts, body caps, DB pool saturation, Valkey outage behavior, bounded queue backpressure and recovery. Do not test public endpoints or distributed flooding.

No performance or rate-limit effectiveness claim is made from this run.
