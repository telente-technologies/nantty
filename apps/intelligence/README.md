# Zudomart Intelligence

Python service that owns every algorithmic part of Zudomart: feed and clip ranking, social proof,
recommendations, ads (targeting, auction, pacing, ad load), trending, search re-ranking, fraud/risk
scoring, experiments, and the offline training pipeline.

**The TypeScript API owns the product, Python owns intelligence, events connect them.** Python never
reads the product database: the API sends candidates and features, Python returns scores and orderings,
and the API forwards events that Python stores as Parquet and turns into online features in Redis.
The API falls back to deterministic logic whenever this service is slow or down.

The endpoint and event contract is in [apiContract.md](apiContract.md).

## Layout

The project mirrors a Zudojs app (`apps/api/src`): shared kinds at the top of `src/`, one folder per
domain under `src/modules/`, CQRS commands/queries with handlers, controllers, routes and a module entry.

```
src/
  app.py            create_application(): container, modules, error handlers, middlewares (app.ts)
  server.py         uvicorn entry point (server.ts)
  container.py      builds settings, feature store, model holder, services, command/query buses (container.ts)
  configs/          settings (pydantic-settings), heuristic ranking weights
  constants/        signed-request header names
  controllers/      health controller
  databases/        Redis and in-memory feature backends
  dtos/             shared contract DTOs (money, viewer context, response metadata)
  enums/            ranking surfaces
  errors/           error types and JSON error handlers
  events/           event envelope and payload DTOs (the ingestion contract)
  integrations/     dataset storage (local directory or S3-compatible)
  interfaces/       feature backend protocol, CQRS base classes, module protocol
  jobs/             training, evaluation, synthetic data and compaction jobs + CLI (pipeline_cli_job.py)
  loaders/          module/route loading, security middlewares, lifespan background jobs
  loggers/          structured JSON logging
  middlewares/      HMAC signature + replay protection, body limits, rate limit, access log
  models/           shared domain models (viewer online features)
  repositories/     online feature repository + keyspace, feature-log Parquet repository
  routes/           health routes
  services/         shared algorithms (candidate filtering, diversity re-rank, prediction, currency)
  types/            shared type aliases
  utils/            decay maths, signing, CQRS buses, dataset/metrics/training helpers
  validators/       constrained field types (opaque ids, topics, country/currency codes)
  modules/<module>/
    <module>_module.py   module entry: registers handlers, builds the router
    commands/<name>/<name>_command.py + <name>_handler.py
    queries/<name>/<name>_query.py + <name>_handler.py
    controllers/ routes/ services/ dtos/ (+ repositories/ models/ constants/ validators/ where needed)
tests/              mirrors src: tests/modules/<module>/, tests/middlewares/, tests/databases/, tests/jobs/
```

Modules: `feed`, `clips`, `social_proof`, `recommendations`, `ads`, `trending`, `search`, `risk`,
`experiments`, `audio`, `events_ingestion`, `model_registry`, `domain_events` (RabbitMQ consumer, consent, purge), `chat_spam`, `moderation`, `extended_risk`, `creator_eligibility`, `ad_click_prediction`, `trust_advisory` (suspension suggestions to goTrust). Mutations (event ingestion, fingerprint
registration, sound status, experiment exposure) are commands; ranking/scoring/matching are queries.

**Naming**: Zudojs uses `<name>.<kind>.ts`; a dot inside a Python module name cannot be imported, so
the same intent is kept with a snake_case `_<kind>` suffix (`feed_ranking_service.py`,
`rank_feed_candidates_query.py`, `rank_feed_candidates_handler.py`, `feed_module.py`).

## Algorithms

| area | method |
|---|---|
| Feed (For You) | two-stage: heuristic logistic heads pre-rank all candidates, the top 120 are re-scored by HistGradientBoosting (60 trees), 5 heads (like, comment, share, long dwell, purchase intent), blended 1 / 2 / 3 / 0.8 / 4, × freshness (half-life 36 h, floor 0.08) × (1 + 0.5 · creator affinity); greedy diversity re-rank: max consecutive posts per author/store, max consecutive product posts, product share ≤ 40%, topic repetition penalty; dedupe seen, drop blocked/muted/hidden |
| Feed (Following) | chronological with at most 90 min boost from affinity/engagement |
| Clips | completion + rewatch heads, freshness half-life 72 h, exploration slots (default 1 in 5) for new creators via seeded Thompson sampling, no duplicates, no consecutive creator |
| Social proof | close friends (API closeness or learned affinity ≥ 0.3), ≥ 2 friends, value threshold, banners ≥ 5 positions apart |
| Recommendations | item co-occurrence cosine blended with implicit ALS (16 factors) similarity, bought-together from baskets, decayed popularity, store customer topic centroids for lookalike ads; accounts and clips by rule blends |
| Ads | placements feed, clips (reels, portrait + landscape), stories, mart/search (sponsored product tiles), live (in-stream), live_discovery (promoted live streams) with per-placement creative formats and ad-load rules; eligibility (status, schedule, budget, frequency caps, geo, age, interests, lookalike), logistic CTR model, GSP with quality (eCPM), reserve price, probabilistic pacing throttle, ad-load and brand-safety slotting, host creator echo for revenue share |
| Trending | forward-decayed short (6 h) vs long (7 d) velocity, one contribution per actor per item per hour, distinct-actor threshold, report/hide penalty |
| Search | 0.7 text relevance + 0.2 personalisation + 0.1 popularity (+ small freshness tie-break) |
| Risk | rule sets per subject (orders, payouts, account events, coin purchases, coin transfers, gifts, referrals, cashback) combined with noisy-OR, value-flow graph signals from events, logistic model for orders; recommends allow / review / hold, never bans |
| Experiments | deterministic SHA-256 bucketing, per-variant exposure and event counters |
| Audio fingerprinting | Shazam-style landmarks in numpy/scipy: 1024-sample Hann STFT, hop 256 at 8 kHz, local-maximum spectral peaks (≤18/s), anchor→target pairs (fan-out 4, within 63 frames / 96 bins), 26-bit hashes stored in Redis; matching by offset-histogram voting, confidence = aligned / query landmarks; robust to time shifts, volume changes and moderate noise (see tests). Only hashes are stored, never audio |

Offline metrics recorded in each model's `metadata.json`: AUC, log loss, Brier score, expected
calibration error per head, NDCG@10 of the feed blend versus the heuristic baseline, recall@10
(leave-last-out), catalog coverage and intra-list store diversity for similarity.

**Training/serving parity**: the online service logs the exact feature vector it scored for every
served item (`feature_logs/surface=feed|clips|ads|risk`). Training joins those logs with later events
(24 h attribution window), so the model always trains on what it will see at serving time.

**Latency** (dev laptop, loaded, Redis on localhost, 500 feed candidates, trained model): service call
p50 ≈ 32 ms; full in-process HTTP path incl. HMAC check, validation and serialisation p50 ≈ 43 ms,
p95 ≈ 55–67 ms depending on machine load. Levers: `MODEL_SCORED_CANDIDATE_LIMIT`, tree count,
`OMP_NUM_THREADS` (set to 2 in the image), sending fewer candidates.

**Redis notes**: online features are read with pipelines plus one Lua script (multi-key `HGETALL`), with
`hiredis` for fast parsing. Keys span hash slots, so use a single Redis node / primary-replica, not
Redis Cluster. Nonce, dedupe and trending-claim keys use TTLs; forward-decayed scores rotate key
generations every 64 half-lives so floats never overflow.

## Run locally

```bash
uv sync
cp .env.example .env            # set INTELLIGENCE_SHARED_SECRET (any non-empty value in development)
uv run zudomart-intelligence-serve
```

Without `INTELLIGENCE_REDIS_URL` the service uses an in-memory feature store (development only).
With `INTELLIGENCE_ENVIRONMENT=development` interactive docs are at `/docs`.

## Training

```bash
uv run zudomart-intelligence-pipeline --storage ./data generate-synthetic-data --users 40 --sessions-per-user 4
uv run zudomart-intelligence-pipeline --storage ./data --registry ./model_registry train --model all
uv run zudomart-intelligence-pipeline --storage ./data --registry ./model_registry train --model feed_engagement --force-activation
uv run zudomart-intelligence-pipeline --storage ./data --registry ./model_registry activate --model feed_engagement --version 20260929T122750Z-7de672a5
uv run zudomart-intelligence-pipeline --storage ./data --registry ./model_registry compact --skip-newer-than-days 1
```

Without `--storage/--registry` the CLI uses `INTELLIGENCE_EVENT_STORAGE_URI` (local path or `s3://`)
and `INTELLIGENCE_MODEL_REGISTRY_PATH`. Models: `feed_engagement`, `clip_watch`, `ad_click`,
`order_risk`, `item_similarity`.

Quality gate: a new version is activated only if its primary metric passes (AUC ≥ 0.55 for classifiers,
recall@10 ≥ 0.01 for similarity) and does not regress more than 0.01 against the active version;
`--force-activation` overrides. Every version is kept; activation is an atomic `ACTIVE` pointer file.
The server hot-reloads active versions every `INTELLIGENCE_MODEL_RELOAD_INTERVAL_SECONDS`. Artifacts are
verified by SHA-256 and, when `INTELLIGENCE_MODEL_SIGNING_SECRET` is set, by HMAC before unpickling;
artifacts trained with a different scikit-learn version are refused.

Cron example:

```cron
15 2 * * *  cd /app && zudomart-intelligence-pipeline compact
30 2 * * *  cd /app && zudomart-intelligence-pipeline train --model all
```

## Environment variables

| variable | default | notes |
|---|---|---|
| INTELLIGENCE_ENVIRONMENT | development | development, test, staging, production |
| INTELLIGENCE_HOST | 127.0.0.1 | 0.0.0.0 inside Docker only |
| INTELLIGENCE_PORT | 8090 | |
| INTELLIGENCE_LOG_LEVEL | INFO | |
| INTELLIGENCE_SHARED_SECRET | (empty) | required; ≥ 32 chars in staging/production |
| INTELLIGENCE_PREVIOUS_SHARED_SECRET | (empty) | accepted during rotation |
| INTELLIGENCE_SIGNATURE_MAX_CLOCK_SKEW_SECONDS | 300 | |
| INTELLIGENCE_NONCE_RETENTION_SECONDS | 900 | must be ≥ 2 × skew |
| INTELLIGENCE_REDIS_URL | (empty) | required outside development |
| INTELLIGENCE_REDIS_SOCKET_TIMEOUT_SECONDS | 0.05 | |
| INTELLIGENCE_REDIS_KEY_PREFIX | intel | |
| INTELLIGENCE_EVENT_STORAGE_URI | ./data | local directory or `s3://bucket/prefix` |
| INTELLIGENCE_S3_ENDPOINT_URL | (empty) | for S3-compatible stores (MinIO, R2) |
| INTELLIGENCE_S3_REGION | us-east-1 | |
| INTELLIGENCE_S3_ACCESS_KEY_ID / INTELLIGENCE_S3_SECRET_ACCESS_KEY | (empty) | |
| INTELLIGENCE_MODEL_REGISTRY_PATH | ./model_registry | |
| INTELLIGENCE_MODEL_SIGNING_SECRET | (empty) | required (≥ 32 chars) in staging/production |
| INTELLIGENCE_MODEL_RELOAD_INTERVAL_SECONDS | 30 | |
| INTELLIGENCE_MAX_REQUEST_BODY_BYTES | 1048576 | |
| INTELLIGENCE_MAX_EVENT_BATCH_BODY_BYTES | 4194304 | |
| INTELLIGENCE_REQUEST_DEADLINE_SECONDS | 0.25 | server-side deadline for ranking routes |
| INTELLIGENCE_RATE_LIMIT_REQUESTS_PER_SECOND | 2000 | per client IP |
| INTELLIGENCE_RATE_LIMIT_BURST_SIZE | 4000 | |
| INTELLIGENCE_FEATURE_LOG_FLUSH_INTERVAL_SECONDS | 10 | |
| INTELLIGENCE_FEATURE_LOG_MAX_BUFFERED_ROWS | 20000 | excess rows are dropped, never blocking requests |
| INTELLIGENCE_EVENT_DEDUPLICATION_RETENTION_SECONDS | 604800 | eventId idempotency window |

## Tests and checks

```bash
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run mypy
```

The suite includes a tiny end-to-end pipeline run (synthetic data, training, registration, hot reload)
that finishes in seconds.

## Docker

```bash
docker build -t zudomart-intelligence apps/intelligence
```

The image runs as a non-root user (code owned by root, only `data/` and `model_registry/` writable) with only runtime dependencies. Audio fingerprinting is pure
numpy/scipy, so no ffmpeg or other system package is needed in this image (the TS media worker does the decoding). Keep it off the public network:

```yaml
services:
  intelligence:
    image: zudomart-intelligence
    env_file: apps/intelligence/.env
    environment:
      INTELLIGENCE_REDIS_URL: redis://redis:6379/3
    expose: ["8090"]
    networks: [intelligence]
    volumes:
      - intelligence-data:/app/data
      - intelligence-models:/app/model_registry
  api:
    networks: [intelligence, public]
networks:
  intelligence: {internal: true}
  public: {}
volumes:
  intelligence-data: {}
  intelligence-models: {}
```

## Security

- Internal only: every `/v1` request needs an HMAC-SHA256 signature over method, path+query, timestamp,
  nonce and body hash; ±5 min clock skew; nonces are single-use (Redis), replay store outage fails closed.
- Only opaque/hashed ids and behavioural features are accepted; no names, emails, phones or raw search text.
- Strict Pydantic validation (unknown fields rejected), body size limits, per-client rate limiting,
  per-request deadline, JSON logs without payloads, docs disabled outside development.
- Model artifacts are integrity-checked (SHA-256 + HMAC, required outside development) and rejected if
  trained with a different scikit-learn version; the registry directory must be write-restricted.
- Python returns decisions and scores only; it never moves money or bans accounts.
