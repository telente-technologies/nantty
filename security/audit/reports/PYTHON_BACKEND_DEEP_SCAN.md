# Python Backend Deep Scan — Gaps, Bugs & Security Issues

**Scope:** `services/python/intelligence` (Zudomart Intelligence — FastAPI, Python 3.14) — ~21.4K LOC across `src/` + `tests/`
**Date:** 8 Oct 2026 · **Method:** automated tooling + 6 parallel deep-review agents + lead review of core security infrastructure
**Companion to:** `GO_BACKEND_DEEP_SCAN.md` (Go backend, same directory)

---

## 1. Executive summary

**109 findings: 2 Critical · 22 High · 59 Medium · 24 Low · 2 Info**

| Area | Prefix | Count | Critical | High | Medium | Low | Info |
|---|---|---|---|---|---|---|---|
| HTTP surface & validation | PYHTTP | 14 | 0 | 2 | 7 | 5 | 0 |
| Crypto, secrets & PII | PYSEC | 14 | 0 | 2 | 9 | 3 | 0 |
| Event/messaging layer | PYEVT | 19 | 1 | 5 | 9 | 4 | 0 |
| ML lifecycle, jobs & storage | PYML | 20 | 0 | 3 | 11 | 4 | 2 |
| Business logic (ads/risk/moderation) | PYBIZ | 17 | 0 | 2 | 13 | 2 | 0 |
| Concurrency, resources & bugs | PYBUG | 25 | 1 | 8 | 10 | 6 | 0 |

The service is **clean on every static gate** — ruff (including bandit-style `S` rules), mypy `strict` (550 files), 220 passing tests, and zero known dependency vulnerabilities. Its HMAC request-signing, DTO validation discipline (`extra="forbid"` everywhere), and RabbitMQ transport layer are genuinely strong. The problems are one layer deeper: **fail-open defaults in every safety decision, unsupervised background loops that die silently, blocking sync I/O on the event loop, lease/claim lifecycle bugs that permanently drop events, and operational config that silently no-ops entire trust pipelines.**

### Top 10 must-fix

| # | ID | Sev | Issue |
|---|---|---|---|
| 1 | **PYEVT-001** | Crit | Null publishers silently drop *all* trust/content/bot/live-safety advisories in whole config classes (SQS mode has **no** content-score publisher at all; empty `RABBITMQ_URL` → 5 publishers Null + **zero consumers started**), while callers report `published=True` and hold dedup claims |
| 2 | **PYBUG-001** *(= PYHTTP-001, PYEVT-004)* | Crit | Sync boto3 `detect_moderation_labels` runs on the event loop — one AWS call stalls every request/health/consumer on that worker (0.25 s deadline can't preempt sync code) |
| 3 | **PYEVT-002** *(= PYBUG-007, PYHTTP-004)* | High | `except Exception` misses `CancelledError` → claims leak on shutdown/cancel; redelivery acked as "duplicate" → **permanent silent event loss** (incl. account-deletion events) |
| 4 | **PYML-001** *(= PYBUG-004)* | High | Model-reload and feature-flush loops have no try/except supervision → one bad artifact/parquet batch kills them forever; `/health/ready` stays green |
| 5 | **PYBIZ-001** | High | Missing FX rate disables **every** value-threshold fraud rule (weight `0.0` marker) and zero-fills the model's amount feature — high-value orders sail through risk |
| 6 | **PYBIZ-002** *(= PYHTTP-002, PYBUG-006)* | High | Image moderation `except Exception → {}` → score 0 → `suggested_action="allow"`; failure indistinguishable from a clean image, no log |
| 7 | **PYSEC-001** | High | Replay protection falls back to **per-process** in-memory claims (no Redis + `SERVER_WORKERS=2` default) → each worker accepts each signed request once; also splits dedup/consent tombstones |
| 8 | **PYSEC-002** | High | GDPR purge deletes Redis keys only — `actor_id` + full payloads live forever in `raw_events/` and `feature_logs/` parquet; no retention job exists |
| 9 | **PYML-002** *(= PYBUG-005)* | High | Feature-log flush takes rows *before* the try block → `OSError` drops up to 20 000 training rows per incident; `dropped_row_count` is never read anywhere |
| 10 | **PYBUG-022** | Med | JSON log formatter discards **every traceback** (only `exception_type` survives) and the 500-handler logs no `exc_info` → all fail-open bugs above shipped undiagnosable |

Runner-ups: PYEVT-003 (SQS deletes poison messages, no DLQ), PYEVT-005/006 (side-effect publish failure DLQs upstream events; `nack(requeue=True)` can loop forever), PYSEC-009/010 + PYML-009/010 (model pickle TOCTOU + unsigned-artifact fail-open → RCE), PYBIZ-006 (reserve price silently zeroed → auction floor disabled), PYBUG-011 (50 ms Redis timeout makes fail-open paths routine).

### Cross-cutting themes

1. **Fail-open is the default everywhere.** Risk, moderation (text + image), bot, chat-spam, ads, engagement-integrity and value-flow scoring all convert *unavailable* into *clean*: zero scores, false signals, `allow` recommendations. The `degraded` flag exists but nothing enforces it — it is metadata no caller checks (PYBIZ-001/002/003/004/008/010/015, PYML-004/006).
2. **Nothing is supervised or observable.** Background loops die on first unhandled exception (PYML-001/002, PYBUG-004); readiness checks only Redis (PYHTTP-010, PYEVT-008); and even if they logged, the JSON formatter throws tracebacks away (PYBUG-022). The system cannot distinguish "serving model" from "model gone" or "queue flowing" from "queue dead".
3. **The event loop is not actually async.** Blocking AWS calls (PYBUG-001) and measured 45–55 ms CPU bursts in ranking/headline/validation paths (PYBUG-002) run inline; one unbounded `to_thread` pool backs everything (PYBUG-003).
4. **Claim/lease lifecycle is the reliability core — and it leaks.** `CancelledError` escapes `except Exception` at every claim site; audio claims carry a **20-year** TTL with release only on one error type; dedup namespaces collide across producers (PYEVT-002/013, PYHTTP-004, PYBUG-007/008).
5. **Config fails open, not fast.** Null publishers, skipped consumers, per-worker replay state, digest-only model artifacts, empty `id_hash_secret` fallback — every one is a silent degradation rather than a startup error (PYEVT-001, PYSEC-001/003/010, PYML-009, PYHTTP-007).
6. **PII at rest is unmanaged.** Purge is Redis-only with race/window/HLL gaps; parquet grows unbounded with no retention or erasure path (PYSEC-002/005/006/007, PYML-012).
7. **Model supply chain.** Integrity checks exist but are TOCTOU'd (`verify` on one open, `pickle.load` on another) and bypassable with an empty secret — registry write access → RCE (PYSEC-009/010, PYML-009/010).

---

## 2. Methodology & automated tooling

| Tool | Command | Result |
|---|---|---|
| ruff 0.16.9 (E,W,F,I,B,C4,UP,SIM,N,**S**,RUF,PL,ASYNC,PT,RET,ARG) | `ruff check src tests` | **0 issues** |
| mypy (strict, pydantic plugin) | `mypy src tests` | **0 errors, 550 files** |
| pytest | `pytest -q` | **220 passed, 1 skipped** |
| pip-audit | audit of `uv export` lock | **No known vulnerabilities** |
| Manual lead review | server, app, container, lifespan, middlewares, settings, signature utils, rate limiter | see findings |

Deep review was split across six parallel agents: HTTP surface (PYHTTP), crypto/secrets/PII (PYSEC), messaging (PYEVT), ML lifecycle/jobs (PYML), business logic (PYBIZ), concurrency/bugs (PYBUG). All Critical and High findings were spot-verified against source by the lead before inclusion; every line reference below was checked by its authoring agent.

**Blind spots:** no runtime testing against real Redis/RabbitMQ/SQS/S3 (tests mock these); no load testing to confirm the loop-stall measurements under production traffic; dependency *config* review (lockfile pins) limited to vulnerability audit; the stale worktree copy at `.kilo/worktrees/climbing-respect/apps/intelligence` was excluded as a duplicate.

---

## 3. Critical findings (2)

**[PYEVT-001] Null publishers silently swallow trust/content/bot/live-safety advisories in whole config classes; no guard, no log, callers report success**
- **Locations:** `src/container.py:118-123,126-131,134-141,144-151,166-167,239`; `src/modules/live_safety/live_safety_module.py:79-84`; `src/configs/settings_config.py:40-50,68-74,90-108`; `src/modules/bot_detection/services/bot_scoring_service.py:107-111,124-125`; `src/modules/trust_advisory/services/suspension_suggestion_service.py:33-47`; `src/loaders/lifespan_loader.py:37-54`
- **Detail:** Exact drop conditions. **(a) `event_bus="sqs"`:** content scores → `NullContentScorePublisher` **always** — there is no SQS branch and no `trust_content_scores_queue_url` field exists; sensitivity advisories → Null; live-safety scores → Null; bot/trust → Null when their queue URLs keep empty defaults. `rabbitmq_channels` is forced to `None` in SQS mode (`container.py:239`), so live-safety *consumers* also never start — `jobs-live-frames` grows unbounded, frames never scored. **(b) `event_bus="rabbitmq"` (default) with empty `RABBITMQ_URL`** → `channels=None` → all five publishers Null **and zero consumers started**. No log line exists (container.py imports no logging) and settings validators only check secrets/redis. Worse, the Null *succeeds*: bot scoring returns `published_to_trust=True` and holds its dedup claim 6 h; suspension suggestions hold theirs 24 h — so the advisory is suppressed for the whole window **and the API reports it was delivered**.
- **Fix:** Fail startup in production when `event_bus="rabbitmq"` and `rabbitmq_url` is empty, or when required queue URLs are missing (extend `reject_weak_configuration_outside_development`). Add SQS publishers for content-score/sensitivity/live-safety or explicitly reject `event_bus="sqs"` until they exist. Log ERROR whenever a `Null*Publisher` is constructed, and make Null publishers raise-or-flag so `published_to_trust` cannot report `True`.

**[PYBUG-001] Sync boto3 `detect_moderation_labels` executes on the event loop inside an async request handler** *(= PYHTTP-001, PYEVT-004)*
- **Locations:** `src/modules/content_scoring/services/image_moderation_interface_service.py:56-61`; `src/modules/moderation/queries/classify_image/classify_image_handler.py:13-14`; `src/modules/content_scoring/services/content_scoring_service.py:146`; `src/modules/live_safety/services/rekognition_image_moderation_model_service.py:39-59`
- **Detail:** `ImageModerationService.classify_image` is a plain `def` making a blocking AWS network call, invoked directly from an `async def` handler on `/v1/moderation/classify-image` **and** inline from the AMQP/SQS domain-event consumer (`content_scoring_service.py:146`). The route's `run_within_request_deadline` (0.25 s default) uses `asyncio.timeout`, which can only fire at an await point — it cannot preempt blocking code. Worst case the worker stalls for boto3's default 60 s connect/read timeout; every other request, heartbeat, and `to_thread` completion on that worker stalls with it. When the call finally returns, the expired deadline discards the result → 503. The codebase already does this correctly elsewhere (`asyncio.to_thread` in `live_safety_scoring_service.py:69,91`) — these two paths just miss it. Measured companion issue: ranking/headline/validation CPU runs 45–55 ms inline per request (PYBUG-002).
- **Fix:** Run the classify call through `asyncio.to_thread` (or an async AWS client) with an explicit boto3 `Config(connect_timeout, read_timeout)`, give this route its own longer deadline, and audit `content_scoring_service.py:146` for the consumer path.

---

## 4. High findings (22)

**[PYHTTP-001] Blocking AWS Rekognition call defeats the request deadline** — *see PYBUG-001 (Critical) for full detail.*
- **Locations:** `src/modules/moderation/queries/classify_image/classify_image_handler.py:13-14`; `src/modules/moderation/moderation_module.py:18`

**[PYHTTP-002] Image moderation fails open: any model exception yields `suggested_action: "allow"`** — *see PYBIZ-002.*
- **Locations:** `src/modules/content_scoring/services/image_moderation_interface_service.py:58-61,70-76`; action decided at `:44-49`
- **Detail:** `except Exception: raw_scores = {}` swallows every model failure (unsupported format, missing S3 object, throttling, credential errors) → empty scores → `score=0.0` → `allow` with HTTP 200. `no_signal=True` is set but the action still says allow. Text moderation by contrast marks `degraded=True` (`content_moderation_service.py:36,64-65`) — inconsistency, not policy. A caller can bypass moderation by referencing an object Rekognition rejects.
- **Fix:** Treat model failure as `review`/`block` (or 503), surface `degraded` like text moderation, and log the exception.

**[PYSEC-001] Replay protection becomes per-process when Redis is unconfigured (cross-worker replay)**
- **Locations:** `src/container.py:112-115` (empty `redis_url` → `InMemoryFeatureBackend`); `src/loaders/middleware_loader.py:21`; `src/databases/in_memory_feature_database.py:19,33-43`; `src/server.py:24-25`; `.env.example:11,49` (shipped default: Redis empty + `SERVER_WORKERS=2`); `src/configs/settings_config.py:96-97`
- **Detail:** With Redis optional outside production and the documented default `SERVER_WORKERS=2`, `SignedRequestMiddleware` claims nonces in an in-process dict — each worker accepts the same validly signed request once, so a captured request replays against *every* worker within the 300 s skew window. The same split store breaks event de-duplication (`event_ingestion_service.py:83`) and consent/deletion tombstones (`domain_event_consumer_service.py:88`) across workers. There is no direct check that replay protection is distributed — only two independent settings (environment + redis_url) guard it indirectly.
- **Fix:** Settings validator: reject `server_workers > 1` (or non-test environments) when `redis_url` is empty; ship `SERVER_WORKERS=1` with empty Redis in `.env.example`; hard-fail startup if the nonce backend is in-memory outside tests.

**[PYSEC-002] GDPR purge never reaches data at rest (parquet); no retention/erasure path exists**
- **Locations:** `src/modules/domain_events/services/personal_data_purge_service.py:45-67` (backend/Redis deletes only); `src/modules/events_ingestion/repositories/raw_event_parquet_repository.py:15-45` (stores `actor_id`, `country`/`region`, full `context_json`/`payload_json`); `src/repositories/feature_log_parquet_repository.py:16-28,63-87`; `src/jobs/compact_datasets_job.py:34-67` (merges only — never deletes partitions); `Dockerfile:25`
- **Detail:** `purge_account`/`purge_personalization_features` delete Redis keys only. Erased users' identifiers and behavioural payloads remain indefinitely in `raw_events/` and `feature_logs/` (S3 or local plaintext disk). No code anywhere deletes or expires these partitions and no per-actor rewrite exists — an erasure request cannot be honoured for on-disk data.
- **Fix:** Retention job deleting date partitions older than policy; partition/hash-prefix feature logs by pseudonymous actor id or rewrite raw-event partitions dropping erased actors; document bucket SSE and retention.

**[PYEVT-002] Dedup claim taken before processing is never released on cancel or on release failure → redelivery acked as "duplicate" → permanent silent event loss** *(= PYBUG-007; sibling of PYHTTP-004, PYBUG-008, PYBUG-021)*
- **Locations:** `src/modules/domain_events/services/domain_event_consumer_service.py:87-94`; `src/utils/amqp_message_settlement_util.py:48-56`; `src/loaders/lifespan_loader.py:59-62`; `src/databases/redis_feature_database.py:58-64`; `src/modules/domain_events/repositories/sqs_domain_event_queue_repository.py:55-63`
- **Detail:** `process_message_body` claims `event:domain:<id>` **before** `apply_event`, releasing only in `except Exception`. `asyncio.CancelledError` is a `BaseException` — caught by neither handler. Graceful shutdown cancels the consumer mid-message → claim stays, message requeues, and on next boot the redelivery returns `"duplicate"` and is **acked**. An `account.deletionExecuted` purged halfway is never completed; a `post.created` feature write is dropped. Same outcome when the claim-release itself fails (`delete_keys` raises `FeatureBackendUnavailableError`, replacing the original error — PYBUG-021). SQS has the identical shape.
- **Fix:** Release the claim on `BaseException` (or `try/finally`), or use a two-phase claim with a short-TTL unconfirmed claim so redelivery reprocesses instead of acking.

**[PYEVT-003] SQS poller deletes validation-rejected messages (no DLQ copy) and retries exceptions forever with fixed backoff**
- **Locations:** `src/modules/domain_events/repositories/sqs_domain_event_queue_repository.py:47-64,67-75,11-12,51-52`
- **Detail:** `poll_once` ignores the processing outcome — a `"rejected"` result (malformed JSON, unknown `event_type`, version-skew) falls through to `delete_message`: the poison message is destroyed with only a warning. On the AMQP path the same message goes to `.dlq`, so SQS deployments lose what Rabbit deployments retain. Conversely the exception path does `continue` without deleting and with no attempt counter/redrive policy — a permanently failing message redelivers forever at a fixed, un-jittered 2.0 s interval shared by every replica.
- **Fix:** Route rejected messages to a DLQ (or rely on a redrive policy and stop deleting them), add attempt counting with forward-to-DLQ past a limit, jittered exponential backoff.

**[PYEVT-004] Synchronous boto3 Rekognition call inside the async consumer callback blocks the entire event loop** — *see PYBUG-001 (Critical).*
- **Locations:** `src/modules/content_scoring/services/content_scoring_service.py:139-151` (call at :146); consumer chain `domain_event_consumer_service.py:56-71,118`; `amqp_domain_event_queue_repository.py:42-44`
- **Detail:** `media.processed` → `score_content_for_trust` → sync `classify_image` → blocking AWS call on the loop. Typical 0.5–3 s per item stalls the sequential domain-event loop, live-safety consumers, and all HTTP endpoints including `/health` (deadline 0.25 s → 503s).
- **Fix:** `await asyncio.to_thread(self.image_moderation.classify_image, request, now)` at `content_scoring_service.py:146`.

**[PYEVT-005] Publish failure of a *side* effect (content-score job) poisons the main domain-event pipeline → event retried 5× then DLQ'd**
- **Locations:** `src/modules/domain_events/services/domain_event_consumer_service.py:118-120`; `src/modules/content_scoring/services/content_score_queue_repository.py:32-34`; `src/utils/amqp_message_settlement_util.py:60-68`; `infra/local/rabbitmq/definitions.json` (`x-overflow: reject-publish` on the content-scores queue)
- **Detail:** `score_content_for_trust` runs **before** ingest/feature writes and raises on broker nack/unroutable (`mandatory=True` + `on_return_raises=True`). The queue is declared `reject-publish`, so a backlog nacks every publish → the domain event fails → 5 retry tiers (~42 min) → DLQ → **never ingested**: no trending contribution, no behaviour counters, no raw parquet row. A lagging downstream trust queue converts into upstream event loss.
- **Fix:** Isolate the advisory publish (catch inside `score_content_for_trust`, log + metric), or move scoring post-commit / to a transactional outbox.

**[PYEVT-006] `nack(requeue=True)` on retry-publish failure can loop forever without incrementing the attempt header**
- **Locations:** `src/utils/amqp_message_settlement_util.py:77-82,63-71`; `src/modules/domain_events/repositories/amqp_domain_event_queue_repository.py:41`
- **Detail:** Attempt counting relies solely on `x-zudomart-attempt` written when a retry copy is published. If `publish_retry` itself raises (retry queue full, binding missing, channel error) the message is `nack(requeue=True)` with headers unchanged → `failed_attempt` recomputes to the same value forever. The same failing message redelivers in a tight loop (no sleep, no DLQ, no cap) burning CPU and Redis until publish succeeds. The `MAXIMUM_DELIVERY_ATTEMPTS` cap never engages because it only counts *successful* retry publishes.
- **Fix:** Persist/increment the attempt header before attempting the retry publish; cap requeues with `reject(requeue=False)` → DLX; small backoff on the requeue path.


**[PYML-001] One uncaught exception permanently kills the model reload loop; readiness stays green** *(= PYBUG-004)*
- **Locations:** `src/modules/model_registry/services/active_model_holder_service.py:48,63-66`; `src/modules/model_registry/repositories/model_registry_repository.py:92,101-102`; `src/loaders/lifespan_loader.py:29-36,59-62`; `src/controllers/health_controller.py:13-18`
- **Detail:** `reload_changed_models_synchronously` catches only `(ModelArtifactRejectedError, OSError, ValueError)`. `pickle.load` can raise `ModuleNotFoundError`/`ImportError` (artifact from newer training code), `AttributeError`/`TypeError` (metadata.json valid JSON but not an object), `UnpicklingError`/`EOFError`. None are caught → the exception escapes the bare `while True` loop, the task dies, and because `asyncio.create_task` results are never awaited or given done-callbacks, **all five models stop refreshing forever** while `/health/ready` stays 200 (it only probes the feature backend). The error resurfaces only at shutdown.
- **Fix:** Wrap each loop iteration in `except Exception` (log + continue); `add_done_callback` on every background task to log/restart; expose last-successful-reload time in readiness.

**[PYML-002] Feature-log flush: rows are dropped on failure, and any non-`OSError` silently kills the flush loop** *(= PYBUG-005)*
- **Locations:** `src/repositories/feature_log_parquet_repository.py:89-97,99-102,51-57`; `src/loaders/lifespan_loader.py:33-35`
- **Detail:** `flush_buffered_rows` calls `take_buffered_rows()` **before** the try block; on `OSError` (disk full, S3 outage) it logs and returns 0 — the taken rows are never re-buffered: up to 20 000 training/eval rows permanently lost per incident. Any non-`OSError` from the arrow write (`ArrowInvalid`, `MemoryError`) propagates out and kills the task with no supervision — after which the buffer fills and every subsequent row is silently discarded forever while `/ready` stays green.
- **Fix:** Catch broad exceptions per iteration; re-queue rows on failure (bounded); expose `dropped_row_count` with alerting; supervise the task.

**[PYML-003] Activation never verifies the artifact, and there is no rollback when the activated version is unloadable**
- **Locations:** `src/modules/model_registry/repositories/model_registry_repository.py:75-78`; `src/modules/model_registry/services/model_promotion_service.py:63-65`; `src/modules/model_registry/services/active_model_holder_service.py:44-52`; `src/jobs/pipeline_cli_job.py:92`
- **Detail:** `activate_model_version` only checks name pattern + directory existence — no digest/HMAC verification. The CLI and promotion service can point `ACTIVE` at a corrupted/tampered/wrong-key artifact. When the reload loop rejects it, the pointer is never rolled back: warm instances serve stale models indefinitely (undisclosed) and cold replicas start with **no model at all** (heuristic/rules-only serving). Nothing repairs `ACTIVE` automatically; only a log line signals it.
- **Fix:** Verify integrity inside `activate_model_version` before writing the pointer; after N consecutive rejections, alert and revert to persisted `last_good`.

**[PYBIZ-001] Missing FX rate silently disables every value-threshold risk rule (fail-open)**
- **Locations:** `src/modules/risk/services/risk_rules_service.py:65-81` (marker at :80); `src/modules/risk/services/value_transfer_risk_rules_service.py:19-36`; `risk_rules_service.py:34-44` (`is_at_least(None, …)` → False); `risk_scoring_dto.py:70` (`exchange_rates` defaults to `[]`); `risk_scoring_service.py:104` (`amount_usd or 0.0`)
- **Detail:** When `convert_money_to_usd_or_none` returns `None`, all amount-gated rules (`new_account_high_value`, `first_order_high_value`, `amount_far_above_buyer_median`, `new_payment_instrument_high_value`, `new_seller_high_value`) evaluate false. The only trace is `("exchange_rate_unavailable", 0.0, …)` — weight **0.0**, so the aggregate is unaffected and the score drops, allowing high-value fraud. The model path also feeds `amount_usd or 0.0`, so the model sees "zero amount" too. A caller that omits rates (the default) disables amount-based fraud detection entirely while still emitting a reason row that looks like a flag.
- **Fix:** Treat missing rate as a non-zero-weight rule or fail closed with `hold_for_manual_review`; never blend a model whose amount feature was zero-filled; assert rates exist for the order's currency.

**[PYBIZ-002] Image moderation fails open to allow on model error or unloaded model** *(= PYHTTP-002, PYBUG-006)*
- **Locations:** `src/modules/content_scoring/services/image_moderation_interface_service.py:58-61,22-26,36-37,71-77`; `src/modules/content_scoring/services/content_scoring_service.py:152-153`
- **Detail:** Any exception in the active model (including Rekognition client errors) or a cleared/unregistered model yields `{}` → `no_signal=True` → `score_image_content` returns `None`, so **no `ContentScoreMessage` is published and the image is never scored** — an unmoderated upload. Unlike text moderation there is no heuristic fallback at all, and the response still carries `model_version=model.version`, so downstream believes a real model ran. Failure is indistinguishable from a clean image; on the HTTP path the same swallow yields `suggested_action="allow"`.
- **Fix:** On `except Exception`: log, set `model_version=None`/`"unavailable"`, mark `degraded=True`, return `suggested_action="review"` (or raise for retry); never equate "no signal" with "model failed".






**[PYBUG-002] Feed ranking, headline building, and event validation run tens of milliseconds of pure CPU inside async handlers**
- **Locations:** `src/modules/feed/services/feed_ranking_service.py:140` → `feed_scoring_service.py:69-98` → `head_probability_predictor_service.py:22`; `build_headlines_handler.py:10-11` → `headline_clustering_service.py:46,74,89,97`; `event_ingestion_service.py:35`
- **Detail:** Measured on this checkout: `rank_feed` with 500 candidates blocks **51–55 ms**; `build_headlines_from_posts` with 1000 posts blocks **45.5 ms**; pydantic validation of 500 events blocks ~10 ms — all reached through `async def` handlers, so it is pure loop stall. `MODEL_SCORED_CANDIDATE_LIMIT=120` only bounds the model branch; heuristics still run for all 500.
- **Fix:** Move scoring/clustering/validation cores behind `asyncio.to_thread`/`run_in_threadpool` with existing batch limits; measure p99 loop stall per worker.

**[PYBUG-003] `asyncio.to_thread` default executor is shared by all blocking work with no bound (thread starvation)**
- **Locations:** every `asyncio.to_thread` site — `media_fingerprint_integration.py`, `transcribe_batch_transcription_service.py:62,77,89`, `live_safety_scoring_service.py`, `audio_fingerprint_index_service.py`, `feature_log_parquet_repository.py:94`, `active_model_holder_service.py:61`, queue repositories
- **Detail:** The default `ThreadPoolExecutor` is `min(32, cpu_count+4)` threads per worker, shared by 10 s HTTP fingerprint fetches, audio STFT, parquet writes, model reloads, feature flushes, queue sends and Transcribe polling — with no semaphore anywhere in `src/`. A client-facing deadline of 0.25–3 s abandons only the *await*; the 10 s HTTP thread keeps running. A burst pins the whole pool so flushes/reloads queue behind request work — directly amplifying PYML-002.
- **Fix:** Dedicated executor for critical background work; semaphore/bound on the media-fingerprint path; make fingerprint timeout and request deadline consistent.

**[PYBUG-004] Long-lived background loops die permanently on their first uncaught exception, silently** *(= PYML-001/002)*
- **Locations:** `src/modules/model_registry/services/active_model_holder_service.py:63-66`; `src/repositories/feature_log_parquet_repository.py:99-102`; `src/loaders/lifespan_loader.py:45-56`
- **Detail:** Both loops are bare `while True` with no (or insufficient) `try/except`, no done-callback, no restart, no alert; lifespan only cancels at shutdown. After one bad model file or malformed parquet batch: models never hot-reload and feature rows accumulate until the 20 000-row buffer overflows.
- **Fix:** Per-iteration `try/except Exception` with `logger.exception` + backoff; supervisor/done-callback on every `asyncio.create_task` in lifespan.

**[PYBUG-005] Feature-log rows are dropped silently with no counter, log, or metric** *(= PYML-011)*
- **Locations:** `src/repositories/feature_log_parquet_repository.py:51-57,92-97`; `dropped_row_count` never read anywhere
- **Detail:** On buffer overflow `append_feature_rows` drops rows and increments `dropped_row_count` — grep confirms nothing in `src/` or `tests/` ever reads it. Combined with a dead flush loop (PYBUG-004) and starved flush threads (PYBUG-003), training data can disappear indefinitely with zero signal, indistinguishable from "healthy, low traffic". Risk/feed/ad feature logs are exactly what the next training run consumes, so drops bias recent data.
- **Fix:** Log/export the counter with periodic flush (then reset), surface on `/ready`, fail flush loudly with retries instead of returning 0.

**[PYBUG-006] Image moderation fails open with no log, while still reporting a model version** *(= PYHTTP-002, PYBIZ-002)*
- **Locations:** `src/modules/content_scoring/services/image_moderation_interface_service.py:60-61,71-77`; `content_scoring_service.py:152-153`
- **Detail:** See PYBIZ-002. Additional angle: no logging whatsoever — network/auth/SDK/model errors are byte-identical to "clean image" in the logs, and `model_version=model.version` still reports a version.
- **Fix:** `logger.exception("image_moderation_failed")`, null the version, degraded action, failure counter on `/ready`.

**[PYBUG-007] Uncaught `except Exception` vs `CancelledError` leaks long-lived claims, permanently dropping events** *(= PYEVT-002)*
- **Locations:** `domain_event_consumer_service.py:92-94`; `event_ingestion_service.py:83,91-92`; `audio_fingerprint_index_service.py:33,136,143`; `bot_scoring_service.py:107`; `suspension_suggestion_service.py:35`
- **Detail:** `asyncio.CancelledError` is a `BaseException` in Python 3.14, so `except Exception` does not catch it. On graceful shutdown the claim set before processing is never released; redelivery on next boot hits the claim and returns `"duplicate"` → dropped forever (TTL 7 d). Same pattern for ingestion dedup claims and bot-score/suspension claims.
- **Fix:** Release claims in `except BaseException` / `try/finally`; treat claim release as a shutdown step before cancelling tasks.

**[PYBUG-008] Audio excerpt register leaks a 20-year claim on any failure other than "audio too quiet"**
- **Locations:** `src/modules/audio/services/audio_fingerprint_index_service.py:33` (`EXCERPT_CLAIM_RETENTION_SECONDS = 20 * 365 * 86_400`), `:136,139-141`; `audio_controller.py:30,34-38`
- **Detail:** The claim is taken, then fingerprint matching and writes run; the only release is `except AudioTooQuietOrShortError`. A 3 s request-deadline cancellation at the `to_thread` await, a `FeatureBackendUnavailableError` (likely under the 50 ms Redis timeout — PYBUG-011), or any other exception leaves the claim set for **20 years**: every retry returns 409 `sound_already_registered` forever, with no log distinguishing it from a genuine in-progress registration.
- **Fix:** `try/except BaseException` releasing the claim and re-raising; shorten the TTL to minutes if it only covers "claimed → registered".

**[PYBUG-011] 0.05 s Redis socket timeout is far too tight for the multi-key pipelines this code issues**
- **Locations:** `src/configs/settings_config.py:31`; `src/databases/redis_feature_database.py` (chunked `read_hash_fields`, **un-chunked** `read_sorted_set_highest_members`); `audio_fingerprint_index_service.py` (pipelines of 500+ keys × up to 400 members)
- **Detail:** A 50 ms socket timeout on multi-key pipelines covering hundreds of keys intermittently exceeds budget under any load. Every timeout becomes `FeatureBackendUnavailableError`, which (a) fails reads open, (b) 503s writes, and (c) makes PYBUG-008's claim leak reachable. `read_sorted_set_highest_members` has no chunking at all.
- **Fix:** Raise to ≥0.5 s and keep the request deadline as the client-facing bound; chunk sorted-set reads like hash reads.

---

## 5. Medium findings (59)

### HTTP surface (PYHTTP-003 … PYHTTP-009)

**[PYHTTP-003] Three endpoints have no request deadline**
- `src/modules/events_ingestion/controllers/events_ingestion_controller.py:15-20`; `src/modules/model_registry/controllers/model_registry_controller.py:13-15`; `src/modules/experiments/controllers/experiments_controller.py:41-44`
- These are the only handlers that never call `run_within_request_deadline` (verified across all controllers). The server sets no request timeout — only `timeout_keep_alive: 30` — so a stalled Redis/parquet call on `/v1/events` (up to 500 events / 4 MiB) hangs the request indefinitely and keeps the worker unavailable.
- **Fix:** Wrap all three in `run_within_request_deadline` like every sibling.

**[PYHTTP-004] Audio registration claim leaks on timeout/error → permanent 409**
- `src/modules/audio/services/audio_fingerprint_index_service.py:33,133-145`; `src/modules/audio/controllers/audio_controller.py:30,34-38`
- `register_sound` claims the excerpt key with a 20-year TTL and releases only for `AudioTooQuietOrShortError`. The 3 s deadline cancels the `to_thread` compute or any Redis await after the claim, and any write failure escapes — the claim is never released, so every retry 409s forever. Same class: `event_ingestion_service.py:81-94` releases dedup claims only under `except Exception`, which misses `CancelledError`.
- **Fix:** `try/finally` release when registration doesn't complete; shorten TTL; catch `BaseException` for cleanup.

**[PYHTTP-005] Rate-limit state reset is a bypass primitive**
- `src/utils/token_bucket_rate_limiter_util.py:5,30-33`
- When 10 000 tracked client keys accumulate the map is `clear()`ed — 10k distinct source IPs (trivial with IPv6) reset the throttle for *all* clients, restoring full burst. Replaces any eviction policy with a global reset.
- **Fix:** LRU-evict individual entries instead of clearing the map.

**[PYHTTP-006] Rate limiter keys on transport peer IP while `proxy_headers=False`**
- `src/middlewares/rate_limit_and_access_log_middleware.py:22-24`; `src/server.py:20`; `src/loaders/middleware_loader.py:24-27`; `.env.example:49`
- Behind any LB/nginx every caller shares the proxy IP → one global bucket: a single noisy client exhausts 2000 rps/4000 burst and 429s everyone. Directly exposed, buckets are per-IP but **in-memory per worker** — `SERVER_WORKERS=2` silently doubles effective limits.
- **Fix:** Enable `proxy_headers` with trusted `forwarded_allow_ips` (or key buckets on the HMAC identity); share rate-limit state in Redis when workers > 1.

**[PYHTTP-007] `.env.example` ships a publicly known secret that passes the production strength gate**
- `.env.example:6`; `src/configs/settings_config.py:8,90-101`; `Dockerfile:24`
- `local-only-intelligence-shared-secret-0123456789` is 40 chars, satisfying `MINIMUM_SHARED_SECRET_LENGTH=32`, and the Dockerfile defaults `INTELLIGENCE_ENVIRONMENT=production`. Copying `.env.example` → `.env` and deploying yields a *known* HMAC key — authentication, nonce replay protection and the skew window all defeated for every `/v1/*` route.
- **Fix:** Reject known/example secret values (banned-value list or entropy check) and fail startup if unchanged.

**[PYHTTP-008] Unvalidated `experiment_assignments` strings flow into Redis keys and metrics**
- `src/events/event_envelope_dto.py:35` → `event_feature_update_service.py:192-199` → `online_feature_keyspace_repository.py:94-95,112-113` (TTL 120 d); read path enforces `^[a-z0-9_\-]{1,64}$` at `experiments/dtos/experiment_dto.py:6,10,15`
- `experiment_assignments: dict[str, str]` allows 20 entries of unbounded-length, pattern-free keys/values interpolated directly into `intel:exp:{key}:{variant}` counters for 120 days. Writers are strictly weaker-validated than readers; a signed caller can inflate any experiment's counters, create unbounded key material, and forge `:`-containing keys invisible to the constrained metrics endpoint. Nothing checks the assignment against a registered experiment.
- **Fix:** Apply `EXPERIMENT_KEY_PATTERN` + max length to keys and values at DTO validation; only accept assignments issued by the experiment service.

**[PYHTTP-009] Caller-supplied `image_url` passed straight to Rekognition (cross-object probing + cost)**
- `src/modules/content_scoring/dtos/content_score_dto.py:35` → `rekognition_image_moderation_model_service.py:23-29,54-59`
- `image_url` is only length-bounded; scheme restricted to `s3` (no SSRF) but *any* bucket/key accepted. The response reveals moderation labels for any object the task's IAM role can read (cross-bucket probing via opaque `media_id`), and each call is a billable Rekognition request an authenticated caller can multiply.
- **Fix:** Resolve the key server-side from validated `media_id` (ignore caller URLs); scope IAM to the service's own bucket/prefix.

### Crypto, secrets & PII (PYSEC-003 … PYSEC-011)

**[PYSEC-003] Pseudonymization key defaults to the widely distributed request-signing secret; `id_hash_secret` has no strength requirements and is never provisioned**
- `src/services/identifier_hashing_service.py:13-16`; `src/container.py:154-159`; `src/configs/settings_config.py:26,90-102`; `.env.example` (no `INTELLIGENCE_ID_HASH_SECRET` entry); infra secret lists
- With empty `id_hash_secret`, HMAC-SHA256 derives from `shared_secret` — which *every* signing service holds (TS search/social, Go ads, infra). Any holder can offline confirm user IDs against `u_…` pseudonyms in Redis/parquet (IDs enumerable in many domains). The 32-char rule covers only `shared_secret`/`model_signing_secret`; an operator can set a 1-character `id_hash_secret` in production with no warning. The fallback is mirrored in TS, so misconfiguration is consistent rather than caught.
- **Fix:** Require `id_hash_secret ≥ 32` in staging/prod; provision in infra + `.env.example`; warn on derivation fallback.

**[PYSEC-004] Signing-secret rotation silently re-keys pseudonyms and orphans consent/deletion flags (opt-out bypass after rotation)**
- `loaders/middleware_loader.py:13-16`; `identifier_hashing_service.py:13-16`; `personal_data_purge_service.py:33-43`; `online_feature_repository.py:50-53`; `domain_event_consumer_service.py:126-128`
- Consent opt-out and account-deleted tombstones live under `intel:consent:{u_<hmac>}`. Rotating `INTELLIGENCE_SHARED_SECRET` (the documented rotation path) changes every pseudonym, so `is_personalization_allowed` reads a *fresh, empty* consent key: users who opted out — or were deleted — are treated as consenting again, and previously purged affinity keys re-create under new keys. Old-hash flags are never migrated.
- **Fix:** Dedicated rotation-independent `id_hash_secret` (PYSEC-003); migrate `consent:*` keys on rotation, or refuse rotation when `id_hash_secret` is unset.

**[PYSEC-005] Purge is non-atomic (delete-then-tombstone) and the write path doesn't check the tombstone → PII resurrection race**
- `personal_data_purge_service.py:53-67`; `domain_event_consumer_service.py:121-134`; `event_ingestion_service.py:95,104-132`
- A domain event processed concurrently with `purge_account` can pass the tombstone check and write behaviour/personalization keys *after* the deletes — recreating personal data nothing will remove again. If the tombstone write fails after deletion, the account looks alive and data re-accumulates. Direct `/v1/events` batches never consult the tombstone at all, so gateway-produced events can also re-add keys for an erased account.
- **Fix:** Tombstone first, atomically with deletes (pipeline/Lua); gate ingestion feature writes on consent/deleted checks.

**[PYSEC-006] Ad-frequency purge window shorter than key TTL → user-linked keys survive erasure**
- `personal_data_purge_service.py:50` (today/−1/−2 only) vs `online_feature_keyspace_repository.py:12` (`DAILY_COUNTER_TTL_SECONDS = 3 d`) and `event_feature_update_service.py:164-168` (expiry refreshed per write keyed by `occurred_at` day)
- A key written late on D−3 is alive into day D but its bucket isn't in the purge list. Worse, TTLs refresh on back-dated events (only future skew bounded), so out-of-window buckets can be kept alive indefinitely. The sibling behaviour purge already uses `RETENTION + 1` buckets — the ad-frequency purge forgot the `+1`.
- **Fix:** Purge `TTL_days + 1` buckets; clamp `occurred_at` lower bound at ingestion.

**[PYSEC-007] Long-lived actor-ID set members (HyperLogLog) are never purged**
- `event_feature_update_service.py:194-199` (experiment distinct-users HLL, 120 d TTL); `trending_contribution_service.py:143-146`; `behaviour_feature_service.py:75` (recipients HLL stores *other* users' raw IDs under the sender's key)
- `PersonalDataPurgeService` deletes point keys only; HLL members cannot be removed. The experiment HLL retains the account identifier for 120 days after deletion; recipients HLLs keep a deleted account's raw ID inside *other* users' keys.
- **Fix:** Salted-hash members with short TTLs, or rebuild/replace affected HLLs during purge; document TTL-bounded residual where unavoidable.

**[PYSEC-008] Inconsistent pseudonymization: raw account IDs used as Redis key material; raw `actorId` persisted for `gift.sent`**
- `behaviour_feature_service.py:66,75-82,119`; `online_feature_keyspace_repository.py:103-110`; `domain_event_translation_service.py:43,94-101`; `raw_event_parquet_repository.py:40`
- Personalization/affinity keys use `u_…` pseudonyms while behaviour/profile keys embed raw account IDs — anyone with Redis read/backup access sees raw identifiers regardless of the hashing design. `gift.sent` deliberately keeps raw sender/receiver IDs which land un-pseudonymized in parquet forever (amplifies PYSEC-002).
- **Fix:** Hash at the domain-event boundary for all keyspaces; pseudonymize value-flow actors, keeping raw IDs only in an access-controlled settlement store with retention.

**[PYSEC-009] Model artifact verification is TOCTOU: digest checked on one open, `pickle.load` on a second open** *(= PYML-010)*
- `model_registry_repository.py:90-102`; `artifact_integrity_util.py:24-32`
- The integrity gate defends against a party who can write the registry directory — that party can swap `artifact.pkl` between the digest read and the unpickle, winning the race on every 30 s reload → arbitrary code execution in the service process (with S3/Redis/queue credentials).
- **Fix:** Read bytes once, verify digest+HMAC over the buffer, `pickle.load(io.BytesIO(buffer))`.

**[PYSEC-010] Empty `model_signing_secret` makes artifact "integrity" self-referential (signature check skipped)** *(= PYML-009)*
- `artifact_integrity_util.py:27-33`; `model_registry_repository.py:58-60,62-64`; `settings_config.py:98-99`; `.env.example:22`
- With empty secret the only check is file-hash vs `metadata.json` — both written by whoever can write the directory. Registry write access → rewrite both → `pickle.load` execution. `environment` defaults to `development`, so any deployment that forgets `INTELLIGENCE_ENVIRONMENT` *and* isn't the Docker image (which sets production) runs with unsigned model loads; `environment="test"` also passes the validator.
- **Fix:** Fail closed unconditionally unless `environment == "development"` (or test-only); reject `artifactSignature: null`.

**[PYSEC-011] Queue configuration unvalidated → safety/moderation events silently dropped (Null publishers)** *(same root as PYEVT-001 Critical)*
- `settings_config.py:40-50,68-74`; `container.py:118-151`; `lifespan_loader.py:37-54`
- With `event_bus=rabbitmq` (the default, and `EVENT_BUS` in infra) but empty `RABBITMQ_URL`, the service starts normally: no consumer, all trust/bot/content-score/sensitivity advisories become silent no-ops — a fail-open of the moderation/trust-integrity pipeline with only `Null*` classes and no startup error or metric. `MEDIA_INTERNAL_TOKEN`/`MEDIA_INTERNAL_URL` pairing is likewise unvalidated (media side fails closed, so that case degrades to unavailable).
- **Fix:** Validator rules per PYEVT-001; refuse to build `Null*` publishers outside development.

### Event/messaging (PYEVT-007 … PYEVT-015)


**[PYEVT-007] Trust/safety advisory publish errors swallowed with no retry/outbox; deadline cancellation leaves dedup claim held (6 h/24 h of silence, no log)**
- **Locations:** `src/modules/bot_detection/services/bot_scoring_service.py:106-125,23`; `src/modules/trust_advisory/services/suspension_suggestion_service.py:33-53,15`; `src/modules/content_scoring/services/content_scoring_service.py:132-137`; `src/utils/request_deadline_util.py:7-14`
- **Detail:** Publishes happen inline in handlers wrapped by the 0.25 s deadline. aio-pika's robust channel waits for reconnect inside `publish`, so during a broker blip the deadline cancels it — `CancelledError` is not caught by `except Exception`, so the claim taken at 107/35 is never released: the advisory is suppressed for 6 h/24 h with **no log entry at all**. Even on a normal exception, the message is only logged and dropped — no retry, DLQ, or outbox.
- **Fix:** Release the claim on `BaseException`; move advisory publishing out of the request path (background task with bounded retries); metric every publish failure.

**[PYEVT-008] Health endpoint blind to broker/consumer state; consumers can fail-loop forever while `/health` reports ready**
- `src/controllers/health_controller.py:10-18`; `amqp_domain_event_queue_repository.py:36-60`; `lifespan_loader.py:37-54`
- `report_readiness` pings the feature backend only. A consumer whose queue/exchange is missing, broker unreachable, or never started (empty URL → `channels=None`) logs and retries forever while readiness stays 200. No consumer liveness signal, no startup assertion that queues exist.
- **Fix:** Track per-consumer last-activity/connection state; 503 when no consumer ever started; INFO log on consumer start; fail fast if queue declaration fails.

**[PYEVT-009] Envelope normalizer ignores `schemaVersion`; unknown event types DLQ'd (AMQP) or deleted (SQS) with a generic warning**
- `src/events/contract_envelope_normalizer.py:117-119,173-175,178-181`; `domain_event_consumer_service.py:73-79,83-84`; `domain_event_dto.py:179-204`
- Only *presence* of `schemaVersion` is checked — a v2 envelope with reshaped `data` is flattened anyway; unrecognized `type` falls through to empty payload → validation fails against the closed union → immediate `reject(requeue=False)` with no retry, logging only the error class. During a rolling deploy where a producer emits a new type first, those events are parked in the DLQ (or destroyed on SQS) instead of buffered for the newer consumer.
- **Fix:** Validate version against a supported set; route "future version/unknown type" to an `-unhandled` queue for replay after deploy, distinct from corrupt; include event id/type in rejection logs.

**[PYEVT-010] No payload-size limit anywhere on the queue path (HTTP is limited, the consumer is not)**
- `amqp_message_settlement_util.py:49`; `domain_event_consumer_service.py:75`; `sqs_domain_event_queue_repository.py:55-57`; `settings_config.py:80-81`
- Body limits gate only HTTP. Queue bodies are decoded and `json.loads`-ed unconditionally; a large message (Rabbit default 128 MB) forces full-size parse on the event loop — OOM kills the pod and the unacked message redelivers (compounded by PYEVT-002).
- **Fix:** Reject messages above `MAX_QUEUE_MESSAGE_BYTES` before decoding → DLQ with distinct reason.

**[PYEVT-011] Same-entity events processed concurrently out of order across workers**
- `amqp_domain_event_queue_repository.py:42-44`; `server.py:24-25`; `.env.example:49`; `domain_event_consumer_service.py:121-131`
- Each process is sequential, but 2 workers + replicas compete on one queue with no key-based routing. Concrete races: `consent.withdrawn` vs `post.viewed` for the same actor (guard read before write → personalized event ingested after withdrawal); `account.deletionExecuted` purge vs a concurrent `post.created` that read the tombstone before it was set.
- **Fix:** Re-read guards immediately before writes for state-changing events; per-account Redis lock or actor-hash partitioning.

**[PYEVT-012] Domain claim TTL hardcoded to 7 days while ingestion dedup TTL is configurable → replays after expiry double-count**
- `domain_event_consumer_service.py:31-32,87-88`; `settings_config.py:88`; `event_ingestion_service.py:81-87`
- If an operator lowers `event_deduplication_retention_seconds` or replays a DLQ older than the shorter TTL, both claims expire → full reprocessing: counters, trending contributions and parquet rows counted twice.
- **Fix:** Derive `DOMAIN_CLAIM_TTL_SECONDS` from settings; document DLQ-replay semantics.

**[PYEVT-013] Dedup key namespace collision: producer-supplied `eventId` of `domain:<id>` suppresses the real domain event for 7 days**
- `online_feature_keyspace_repository.py:40-41`; `domain_event_consumer_service.py:31,87-89`; `event_ingestion_service.py:81-87`; `validators/common_field_validator.py:5`
- Both paths use `event_deduplication_key(event_id)` → `prefix:event:<id>`; the domain claim is `prefix:event:domain:<id>` and `OpaqueIdentifier` allows `:`. A signed producer POSTing `eventId="domain:<X>"` writes the exact key the consumer checks for domain event `<X>` → the real event returns "duplicate" and is acked — cross-service suppression/DoS for the claim TTL. Bot/suggestion claims share the flat namespace with different TTLs.
- **Fix:** Separate keyspace functions per claim domain; reject/suffix user-supplied ids so they can't embed internal prefixes.

**[PYEVT-014] Ingestion batch not atomic: claims released only for sink failures (and release itself swallowed) → permanent feature loss or duplicate raw rows**
- `event_ingestion_service.py:81-102,104-110,131-132`; `raw_event_parquet_repository.py:52-64`
- Claims taken at :83 released only in the write-failure branch. Any exception after that point (e.g. `plan_online_feature_updates_for_events` deliberately outside the `try`) propagates to the client while claims stay held → retry counted as duplicates → online feature updates **never applied**. `release_claims_quietly` swallows release failures. Conversely a mid-partition parquet failure + all-claims release causes duplicate rows.
- **Fix:** Guard the full accept path; release claims in a finally-style path for any pre-accept exception; make release retry/alert; report per-partition success.

**[PYEVT-015] Normalizer synthesizes `eventId` from a single field, so distinct events collide and are dropped as duplicates**
- `contract_envelope_normalizer.py:41-47`; `event_ingestion_service.py:74-87`
- `normalize_comment_created` sets `eventId = f"comment.created:{commentId}"` — when `commentId` is absent, every such envelope collapses to `"comment.created:None"` (passes `OpaqueIdentifier`). The first claims the key; all later distinct comments in the retention window are counted duplicates and silently never ingested (200 response).
- **Fix:** Require `commentId` (else reject); include content hash/producer+timestamp in synthesized ids.

### ML lifecycle, jobs & storage (PYML-004 … PYML-013, PYML-018)

**[PYML-004] Risk scoring fails open to rules-only when the model is missing, and reports `degraded=False`**
- **Locations:** `src/modules/risk/services/risk_scoring_service.py:101-122,135-137,66-73`; `src/modules/risk/services/risk_rules_service.py:51-55`
- **Detail:** If `order_risk` is unloaded (cold start, rejected artifact, dead reload loop) `model_score` stays `None` and `final_score = rule_score`. An order that trips no rule yields `rule_score = 0.0` → `classify_risk_score(0.0) == ("low","allow")`. Crucially `degraded` is computed only from feature-flow availability — **model absence never sets `degraded`**; callers monitoring `metadata.degraded` see a healthy response. The same "model missing ⇒ heuristic, `degraded` untouched" pattern exists in feed, ads, ad-CTR and recommendations.
- **Fix:** Set `degraded=True` whenever `loaded_model is None` (all five services) and alert; consider a floor score or explicit fail-closed policy for order risk.

**[PYML-005] Risk model inference is unguarded (unlike feed/ads), turning model faults into HTTP 500s** *(= PYBIZ-007)*
- **Locations:** `src/modules/risk/services/risk_scoring_service.py:106-108`; contrast `src/services/head_probability_predictor_service.py:44-54`; `src/errors/error_response_handler.py:30,36`
- **Detail:** The risk path type-checks `feature_names` only, then calls `predict_head_probabilities` and indexes `probabilities["fraud"]` with no try/except. A bundle without a `fraud` head (KeyError) or an estimator raising (shape/dtype drift) propagates to the global handler → 500 for the entire risk request. Every other consumer routes through `predict_heads_with_model_or_heuristic`, which catches `ValueError, AttributeError, TypeError` and degrades to heuristics.
- **Fix:** Reuse `predict_heads_with_model_or_heuristic` (head-superset check + try/except), fall back to rules-only, set `degraded` per PYML-004.

**[PYML-006] Text-moderation model is never registered — service is permanently heuristic-only yet reports not-degraded**
- **Locations:** `src/container.py:181-182`; `src/modules/moderation/services/moderation_model_interface_service.py:14-23`; `src/modules/moderation/services/content_moderation_service.py:26-36,64-65`
- **Detail:** `ModerationModelHolder.register_model` has **no production caller** (only the image holder is wired). `active_model` is always `None`, so `classify_content` runs heuristics only and — because `degraded=True` is set exclusively inside `if model is not None:` — responses claim `degraded=False`. A dormant model path plus a misleading health flag: nobody can tell moderation ML is offline.
- **Fix:** Wire and reload a text model, or explicitly set `degraded=True`/document heuristic-only posture; add a wiring assertion test.


**[PYML-007] `item_similarity` promotion metric (recallAt10) computed with train/eval leakage**
- `src/jobs/train_item_similarity_job.py:161-183,201,126-143`; gate `model_promotion_service.py:13,31,38`
- `similar_items` is built from the **entire** interaction matrix, then leave-last-out recall asks whether the held-out interaction appears in top-10 neighbours *computed including that same interaction*. For an actor with exactly two products the pair's only co-occurrence is the held-out row — hit essentially guaranteed. `recallAt10` is the primary promotion gate metric, so promotion decisions rest on optimistically biased numbers; every version is biased equally, so regressions can hide under inflation.
- **Fix:** Exclude held-out rows from co-occurrence/ALS when scoring, or time-split train/eval.

**[PYML-008] Quality-gate decision made before registration with no CAS; `--force-activation` can install a `None` metric as the baseline**
- `model_promotion_service.py:53-65,36-39`; `src/jobs/pipeline_cli_job.py:36`
- The gate reads active metrics, then registers/activates later without re-checking. Overlapping pipeline runs can activate a good model between decision and activation, and the first run then overwrites `ACTIVE` without regression-checking — the anti-regression gate is not atomic. `--force-activation` activates even when `primary_metric_value is None`; future decisions skip regression comparison entirely (isinstance check fails), permanently neutering the gate for that model.
- **Fix:** Compare-and-swap activation (re-read `ACTIVE` immediately before write); refuse force-activation without a primary metric.

**[PYML-009] Signing-secret enforcement has holes: dev *and* `test` accept digest-only artifacts; CLI bypasses the validator** *(= PYSEC-010)*
- `artifact_integrity_util.py:27-32`; `settings_config.py:77,93-99`; `pipeline_cli_job.py:47-50`; `model_registry_repository.py:58-60,90-95`
- Empty secret → HMAC skipped, `artifactSignature: None` stored — and the ≥32-char rule runs only for staging/production, so `environment="test"` also runs unsigned, with "integrity" self-referential (SHA-256 sits in `metadata.json` beside the artifact). Registry write access rewrites both → arbitrary pickle execution. Additionally the CLI reads `--storage`/`--registry` via raw `os.environ.get(..., "")`, bypassing pydantic validation — mismatched env produces artifacts a signature-enforcing serving side rejects forever (feeding PYML-003).
- **Fix:** Fail closed whenever `environment != "development"`; route the CLI through `load_intelligence_settings()`; store digest/MAC outside the version directory.

**[PYML-010] TOCTOU between signature verification and `pickle.load`** *(= PYSEC-009)*
- `model_registry_repository.py:90-102`
- Digest verified at :90-95, then the file is **reopened** and unpickled at :101-102 — a concurrent writer with registry access swaps the artifact between the two reads; the signature guarantee is voided for the loaded bytes. Same window exists between `read_active_version` and load during reload.
- **Fix:** Read bytes once; verify over the buffer; `pickle.load(io.BytesIO(buffer))`; optionally `O_NOFOLLOW`/inode checks.

**[PYML-011] Feature-log buffer silently drops rows at capacity; the drop counter is never read** *(= PYBUG-005 High)*
- `feature_log_parquet_repository.py:49,51-57`; `settings_config.py:86-87`
- During a traffic burst, slow writes, or a failed flush, `append_feature_rows` truncates and increments `dropped_row_count` — grep confirms it is **never read anywhere in src/ or tests/**. Training data disappears with no metric, alert, or response flag; risk/feed/ad feature logs are exactly what the next run consumes.
- **Fix:** Export as metric/log with alerting; backpressure or spill files over silent truncation.

**[PYML-012] No retention/rotation anywhere: raw events and feature logs grow without bound**
- `compact_datasets_job.py:29-42`; `raw_event_parquet_repository.py:57-63`; `feature_log_parquet_repository.py:80-86`; `settings_config.py:88`
- The only file deletion in the service is compaction removing files it merged. Compaction never removes partitions, so `raw_events/` and `feature_logs/` accumulate daily forever; crash-orphaned `.inprogress-*` files are never reaped. After the 7-day Redis dedup TTL, redelivered messages are rewritten as new rows (readers dedup by `event_id`, masking it for training but not storage cost).
- **Fix:** Retention job / S3 lifecycle rules; GC orphan files; document growth expectations.

**[PYML-013] Compaction crash window duplicates rows in training data** *(= PYBUG-024)*
- `compact_datasets_job.py:38-41`
- Read all `part-*` → write merged `part-<uuid>` → delete originals. A crash between write and delete leaves merged + originals side by side; both match `part-`, so subsequent runs count rows twice — silently inflating event counts, label rates and promotion metrics. No manifest makes the operation idempotent (and `load_feature_logs` does not dedup, unlike raw events).
- **Fix:** Write a `merged-from.json` manifest before deleting and skip listed files on later runs; add row-id dedup to feature-log loads.

**[PYML-018] Critical lifecycle paths are untested (quality gate, flush/reload failure, degraded flags)**
- `tests/modules/model_registry/test_model_registry.py`; `tests/jobs/test_training_pipeline_end_to_end.py:29`; `tests/modules/risk/test_risk_scoring.py:179`
- Strong coverage exists for roundtrip/tamper/signature/hot-reload/corrupt-artifact, but: (a) `decide_whether_to_activate` / `MINIMUM_PRIMARY_METRIC` / regression gate have **zero tests**; (b) the e2e pipeline always trains with `--force-activation`, so the gate never runs end-to-end; (c) `FeatureLogParquetSink` has no tests at all; (d) no test asserts `degraded=True` when a model is missing (risk test only asserts `False`); (e) no tests for compaction crash-window duplication, concurrent promotion, or reload-loop survival on malformed metadata.
- **Fix:** Gate unit tests (below-minimum, regression, force, None baseline); sink failure/overflow tests; loop-resilience tests; missing-model `degraded` assertions per service.

### Business logic — ads, risk, moderation (PYBIZ-003 … PYBIZ-015)

**[PYBIZ-003] Text moderation model failure degrades to keyword-only scoring, crafted text gets `allow`**
- **Locations:** `src/modules/moderation/services/content_moderation_service.py:28-36,47-53`
- **Detail:** On model exception only `evaluate_text_heuristics` remains. Text that matches no regex (obfuscated slurs, non-English abuse, code-switched scams) scores 0 → `suggested_action="allow"` while `degraded` is only metadata — no caller-visible action change, no model retry.
- **Fix:** When degraded and the model was expected, floor the action at `review` for user-visible surfaces, with a distinct `classifier_sources` entry callers can gate on.

**[PYBIZ-004] Ad budget/frequency/pacing fall back to caller snapshots during feature-store outage; spend/impression writes are best-effort**
- **Locations:** `src/modules/ads/services/ad_selection_service.py:107-109,122-124`; `src/modules/events_ingestion/services/event_ingestion_service.py:104,131-132`; `src/modules/events_ingestion/services/event_feature_update_service.py:179-183`
- **Detail:** On Redis outage `impressions_today_by_campaign` and `spend_today_by_campaign` are empty; frequency caps then depend on optional caller snapshots (default `{}` → cap never trips) and pacing/budget on a possibly stale `spent_today`. Separately the real charge/impression increments are written best-effort (log-and-drop on backend errors), permanently eroding the counters eligibility reads. `degraded` is only response metadata — nothing fails closed.
- **Fix:** Reject placement for budget-capped campaigns when spend/frequency reads fail (or require a non-empty snapshot); make spend writes retriable/durable instead of swallowed.

**[PYBIZ-005] Ad eligibility is read-then-act with no atomic budget reservation (overspend race)**
- **Locations:** `src/modules/ads/services/ad_eligibility_service.py:107-115`; `event_feature_update_service.py:179-183`
- **Detail:** Budget/frequency checks read a snapshot; nothing debits between the eligibility decision and the later `Charged` event. Two concurrent selection requests both pass `has_budget_for_one_more_charge` and both serve, overshooting `daily_budget` by up to remaining balance × concurrency (amplified by PYBIZ-004's lost updates).
- **Fix:** Short-TTL Redis reservation (`INCRBY` + expiry keyed by auction id) at eligibility time, or re-check on a monotonic `last_spend_updated_at` before assigning slots.

**[PYBIZ-006] Reserve price silently zeroed when FX rate for the reserve currency is missing**
- **Locations:** `src/modules/ads/services/ad_selection_service.py:180-183` (`convert_money_to_usd_micros(...) or Decimal(0)`); contrast `ad_eligibility_service.py:102-105`
- **Detail:** Asymmetric failure policy: a *bid* in a currency with no rate is rejected (fail closed) but a *reserve* with no rate becomes `Decimal(0)` — the auction floor is disabled and ads clear at bid-derived price. `or Decimal(0)` also masks a legitimate 0 result. Direct revenue-integrity loss for reserved auctions in unrated currencies.
- **Fix:** If `reserve_price_per_mille` is set and the rate is missing, return `missing_exchange_rate` or reject with `reserve_unavailable` — never silently drop the floor.


**[PYBIZ-007] Risk scoring crashes on head-name mismatch (unguarded `probabilities["fraud"]`)** *(= PYML-005 High)*
- `src/modules/risk/services/risk_scoring_service.py:106-108`; contrast `head_probability_predictor_service.py:44-54`
- The path guards `feature_names` but never checks `"fraud" in bundle.heads` and has no try/except; a bundle with a renamed/dropped head raises `KeyError` → 500 for the entire risk request. The sibling helper does both the head-superset check and the exception fallback.
- **Fix:** Reuse `predict_heads_with_model_or_heuristic`; fall back to rules-only on incompatibility.

**[PYBIZ-008] Value-flow signals degrade to all-false, turning off ring/collection-point transfer rules**
- `src/modules/risk/services/value_flow_feature_service.py:86-87`; used at `risk_scoring_service.py:91-98`; rules `value_transfer_risk_rules_service.py:45-56`
- On Redis outage the degraded `ValueFlowSignals()` defaults every field falsy, so `counterparty_previously_sent_to_actor` and `counterparty_distinct_incoming_sources >= 20` are false → those rules never fire and the score drifts to allow. `degraded` is metadata only.
- **Fix:** When `needs_flow and not flow.available`, raise the rule floor (non-zero `value_flow_unavailable` reason) or force `hold_for_manual_review` for coin_transfer/gift subjects.

**[PYBIZ-009] Live-safety scoring exceptions dead-letter without retry (unscored frame, no re-drive)**
- `live_safety_scoring_service.py:55-64`; `amqp_live_safety_job_queue_repository.py:23-24`; `amqp_message_settlement_util.py:52-55`
- The single `except ValueError, KeyError, TypeError, ValidationError` wraps **the entire job body** — including message construction/validation during *scoring* — converting any such exception into `"rejected"` → immediate dead-letter with **no retry tiers** (generic exceptions do get retries). A safety frame can be silently dropped with a warning; the narrow catch was meant for malformed payloads only.
- **Fix:** Split the try — wrap only `model_validate` (poison → reject); scoring exceptions take the retry path.

**[PYBIZ-010] Engagement-integrity detection fail-open: empty features + swallowed counter writes disable manipulation detection everywhere**
- `src/services/ranking_context_service.py:38-43`; `event_ingestion_service.py:104,131-132`; `engagement_integrity_service.py:40,75-77`
- If viewer/item stats are unavailable or lost, signals stay zeroed → `manipulated=False`, `trusted_engagement_share=1.0`: manipulated posts are not discounted in ranking, headline clustering keeps them eligible, trending exclusion skipped, `flag_manipulated_authors` never fires. A coordinated pod gets clean ranking during any Redis degradation window.
- **Fix:** Per-item `integrity_unavailable` flag; treat unknown integrity as low trust (floor share < 1); make counter writes durable.

**[PYBIZ-011] Manipulated-engagement suspension suggestions bypass the configured 0.8 threshold**
- `src/modules/feed/services/feed_ranking_service.py:219-226` (`max(assessment.suspicion_score, 0.8)`); `suspension_suggestion_service.py:14,30` (`THRESHOLD = 0.8`)
- Every manipulated item is submitted at ≥ 0.8 regardless of actual suspicion, so anything flagged `manipulated` always reaches the suggestion threshold — the configured policy knob is defeated and suggestions become unconditional.
- **Fix:** Pass the score unchanged, or make the floor an explicit named constant reviewed with the threshold policy.

**[PYBIZ-012] Text moderation has no self-harm (or hate) category, so self-harm posts auto-allow**
- `moderation/dtos/content_moderation_dto.py:8` (`ModerationCategory` = scam/spam/harassment/violence/prohibited_goods/personal_data only); `moderation_text_heuristics_service.py:81-93,33`
- Heuristics and the classifier DTO can only emit six categories; "I want to end my life" / method-sharing matches no rule → score 0 → `allow`. Self-harm detection exists only for live transcripts and image labels — posts/comments/captions/bios have no path at all.
- **Fix:** Add `self_harm` (and `hate`) to category enum, heuristics and model contract; route unclassified-severity posts through live-safety self-harm heuristics as a floor.

**[PYBIZ-013] Help-answer drafting embeds untrusted question/answer text raw into markdown (injection)**
- `help_content/services/help_answer_drafting_service.py:99-114`; `help_text_guard_service.py:1-40`
- `redact_residual_personal_data` only replaces emails/links/amounts — HTML/markdown in user text passes through unchanged. A support question containing `<script>…` or markdown link/image payloads lands verbatim in `answer_markdown`/`title` → XSS or content spoofing wherever the draft is rendered without escaping.
- **Fix:** Escape/reject `<`, `>`, backticks, raw URLs (markdown allow-list sanitiser) before formatting; clamp `title` to plain text.

**[PYBIZ-014] Trending headline titles embed raw post text with no markup neutralisation**
- `trending/services/headline_text_service.py:76-86,123-130,132-136`
- The cleaner removes URLs, mentions, hype words, repeated punctuation — but not `<`/`>`/quotes/brackets. Post text such as `<img src=x onerror=…>` becomes the headline `title`. Same injection-boundary problem as PYBIZ-013 on a higher-visibility surface.
- **Fix:** Neutralise markup (`[<>]` strip or html-escape) in `clean_post_text_for_headline` before title assembly.

**[PYBIZ-015] Chat-spam scoring fails open to `allow` when stored behaviour is unavailable**
- `chat_spam/services/chat_spam_scoring_service.py:86-97`; `behaviour_feature_service.py:106-135`
- During Redis outage `merge_stored_behaviour` never runs, so fan-out recipient counts, report/block rates and message velocity are all 0 → `score ≈ 0` → `recommended_action="allow"`. `degraded` is metadata-only; no score floor.
- **Fix:** When `use_stored_behaviour` and the store is unavailable, return `level="medium"`/`action="throttle"` (or raise to the caller so upstream can defer).

### Concurrency, resources & bugs (PYBUG-009 … PYBUG-022)

**[PYBUG-009] Model→heuristic fallback is a silent `except …: pass`**
- `src/services/head_probability_predictor_service.py:52-53`
- Silently degrades from the trained bundle whenever inference breaks (feature-dimension mismatch after model swap, dtype issue). `ranking_source` changes to `"heuristic"` but nothing is logged — a production model silently stops influencing ranking with no error trail.
- **Fix:** `logger.exception("head_model_inference_failed")` before falling through.

**[PYBUG-010] Two more unlogged degradation paths**
- `moderation/services/content_moderation_service.py:35-36`; `experiments/services/experiment_service.py:66`
- Content moderation sets `degraded=True` on feature-backend failure with no log; experiments wraps writes in `contextlib.suppress(FeatureBackendUnavailableError)` so exposure counters are silently lost — skewing metrics and able to make a winning variant look neutral.
- **Fix:** Replace `suppress` with try/except + `logger.warning`; keep degraded flags but log with request id.

**[PYBUG-012] `ad_statistics_key` incremented but never given a TTL**
- `events_ingestion/services/event_feature_update_service.py:166,172,175`
- `HashFieldIncrement` writes with no accompanying `KeyExpiry`, and no delete path covers ad stats (unlike behaviour/experiment counters). One field per ad per window grows without bound → unbounded Redis memory on a hot key type.
- **Fix:** Append `KeyExpiry(..., retention)` to the same operation list, matching the `EXPOSURE_COUNTER_FIELD` pattern.

**[PYBUG-015] Request deadline only enforced at await points; abandons non-idempotent work**
- `src/utils/request_deadline_util.py:7-14`; callers in ad_click_prediction, creator_eligibility, moderation, audio, experiments
- `asyncio.timeout` cannot preempt sync code — against PYBUG-001/002 the 0.25 s deadline is meaningless (loop still stalls; client gets 503 afterwards). Cancelling at an await can abandon a write already in flight: `experiment_service.py:59-65` increments exposure counters, so a deadline-triggered retry double-counts. `to_thread` threads keep running after cancel.
- **Fix:** Treat as advisory for non-idempotent paths — idempotent writes (request-id-keyed set-adds) or background tasks; don't apply a 0.25 s deadline to paths making a 10 s HTTP call.

**[PYBUG-016] Client-supplied `now` can cause `OverflowError` → 500, and unbounded future `now` silently zeroes decay**
- `src/utils/decay_math_util.py:73` (`math.pow(2.0, -elapsed_half_lives)`), `:77-82`; `resolve_request_time` (no bounds)
- `now` is a request field with no bounds. Reproduced: `now=datetime(1970,1,1)` → `OverflowError: math range error` → 500 on every endpoint reading decayed scores (feed, ads, trending, recommendations, ad-click, value-flow risk, chat spam). A far-future `now` silently drives every multiplier to 0.
- **Fix:** Clamp `now` to `[server_time − 24 h, server_time + 5 min]`; guard `math.pow` exponent range (0.0 on underflow, typed error on overflow).

**[PYBUG-017] Zero NaN/inf guards anywhere; NaN degrades risk to "allow" and then 500s**
- `grep isnan|isinf|isfinite src/` → no matches; `decay_math_util.py` (`max(nan, 0.0)` → `nan`); `classify_risk_score`; Starlette `JSONResponse(allow_nan=False)`
- Pydantic rejects NaN on bounded input fields, but `RiskReason.weight`, blend weights and Redis-read floats are unverified: NaN → `max(nan,0.0)` → `nan` → `classify_risk_score(nan)` classifies **`"low"`/`"allow"` (fail-open)**, then the score hits `JSONResponse` → 500. Same value is simultaneously a silent moderation bypass and an availability bug.
- **Fix:** `allow_inf_nan=False` on `ContractModel`; `math.isfinite` sanitize at the trust boundary (logged rejection, never a decision or a 500).

**[PYBUG-018] Non-idempotent `start_transcription_job` + 180 s timeout serialises the audio consumer queue**
- `transcribe_batch_transcription_service.py:62-72,74-84,87`; `rabbitmq_topology_constant.py:4` (`MAXIMUM_DELIVERY_ATTEMPTS = 5`)
- Job name is derived from the segment and reused: if the poll fails after creation (180 s timeout, transient S3 read), the retry calls start again with the same name → AWS `ConflictException` every time → dead-letter after 5 attempts **even though the transcript exists**. Also the AMQP audio consumer processes sequentially, so one stuck segment blocks the queue up to 180 s × 5 attempts ≈ 15 min.
- **Fix:** `get_transcription_job` first and reuse `COMPLETED`; treat `ConflictException` as "poll existing"; per-segment concurrency or shorter timeout with backoff.

**[PYBUG-020] Lifespan shutdown: a flush failure skips Redis and RabbitMQ cleanup**
- `src/loaders/lifespan_loader.py:61-66`
- `flush_buffered_rows()` runs before `close_backend_connections()` / `rabbitmq_channels.close()` and only swallows `OSError` — any other exception propagates out of the `finally` and skips both closes, leaking connections on every shutdown hitting this path.
- **Fix:** Each shutdown step in its own try/except, or `contextlib.AsyncExitStack`.

**[PYBUG-021] Claim-release failure masks the original exception in the domain consumer**
- `domain_event_consumer_service.py:92-94`
- `except Exception: delete_keys; raise` — if `delete_keys` raises (backend down, or `CancelledError` at shutdown), the original processing exception is replaced and lost; the consumer logs the wrong cause and the claim stays set (compounds PYEVT-002). The ingestion path does this correctly via `release_claims_quietly`.
- **Fix:** Mirror `release_claims_quietly`: guarded delete inside the handler, then re-raise the original.

**[PYBUG-022] JSON log formatter discards every stack trace in the service**
- `src/loggers/structured_json_logger.py:6-25`; `src/errors/error_response_handler.py:31-33`
- `JsonLogFormatter.format` overrides `format` completely and never calls `formatException` — it emits only `exception_type` from `record.exc_info`. Verified: `logger.exception("something_failed")` outputs **no traceback**. Every `logger.exception` in `src/` is therefore useless for diagnosis, and `respond_to_unexpected_error` logs `error_type` with no `exc_info` at all — unhandled 500s have neither traceback nor frame. This is why the fail-open bugs above shipped unnoticed.
- **Fix:** Call `self.formatException(record.exc_info)` and append it (e.g. `stack_trace` field); `error_logger.exception(...)` in the 500 handler.

---

## 6. Low & Info findings (26)

### Low (24)

| ID | Title | Location(s) |
|---|---|---|
| PYHTTP-010 | Readiness probe only checks the feature store — RabbitMQ, S3/parquet, model registry unchecked; instance that can't ingest still reports ready | `src/controllers/health_controller.py:13-18`; `Dockerfile:35-36` |
| PYHTTP-011 | `respond_to_http_error` silently drops `HTTPException.headers` (latent: no caller passes headers today) | `src/errors/error_response_handler.py:22-25` |
| PYHTTP-012 | `/v1/models` is the only route without a `response_model` — untyped internal inventory incl. training metrics, no deadline | `model_registry_routes.py:8`; `model_registry_controller.py:13-15` |
| PYHTTP-013 | Signature verified only after the whole body (≤4 MiB) is buffered and hashed — unauthenticated work on the weakest gate | `signed_request_middleware.py:56-66`; `request_signature_util.py:61-68` |
| PYHTTP-014 | Unhandled-error handler logs exception class only — no traceback, no method/path; production 500s undiagnosable (see PYBUG-022) | `src/errors/error_response_handler.py:28-30` |
| PYSEC-012 | Internal media token can be sent over cleartext `http://`; token/URL pairing unvalidated | `media_fingerprint_integration.py:20-33`; `settings_config.py:64-66` |
| PYSEC-013 | Canonicalization interop hazard: Go signer signs raw request-URI, Python verifier uses percent-decoded `scope["path"]` — fail-closed 401 on legitimately encoded paths; no bypass found | `signed_request_middleware.py:64-65`; `martAds.integration.go:127` |
| PYSEC-014 | Hash-format passthrough: any `actor_id` matching `u_[0-9a-f]{40}` skips pseudonymization and is excluded from dual-identity purge | `identifier_hashing_service.py:19-21,30-33`; `domain_event_consumer_service.py:96-98` |
| PYEVT-016 | SQS: 10-message sequential batch, no visibility extension — receipt expiry aborts the batch, redelivery churn | `sqs_domain_event_queue_repository.py:11,47-65` |
| PYEVT-017 | `channel_for_publishing` unlocked check-then-open race → orphaned channels during reconnect storms | `rabbitmq_channel_integration.py:29-42` |
| PYEVT-018 | In-memory feature backend never evicts expired dedup claims → unbounded growth in dev/test | `in_memory_feature_database.py:19,25-50` |
| PYEVT-019 | Silent skips: model exceptions swallowed with no log; unknown live-safety job types acked and dropped (not DLQ'd) | `image_moderation_interface_service.py:58-61`; `live_safety_scoring_service.py:54-65,135` |
| PYML-014 | Order-risk labels joined with no time window; per-order dedup keeps an arbitrary row (label/feature time inversion possible) | `training_dataset_builder_util.py:52-56,160-162` |
| PYML-015 | Promotion audit decisions logged at INFO but the CLI runs at WARNING — gate outcomes (incl. forced regressions) invisible to alerting | `pipeline_cli_job.py:78`; `model_promotion_service.py:66-69` |
| PYML-016 | Orphaned `.staging-*` dirs never GC'd; byte-identical same-second re-registration fails `os.replace` with `ENOTEMPTY` | `model_registry_repository.py:45-46,62-65` |
| PYML-017 | CLI treats `s3://` URIs as local paths for `generate-synthetic-data`; empty S3 keys fall back to anonymous credentials | `pipeline_cli_job.py:80`; `dataset_storage_integration.py:27-38` |
| PYBIZ-016 | Experiment exposures count assignment *calls* (not distinct users); write errors suppressed → skewed CTR/SRM denominators | `experiment_service.py:61,66,78-87` |
| PYBIZ-017 | Exploration-share rounding under/over-delivers slots: banker's rounding, hard 50 % cap, zero slots when `output_limit < spacing` | `exploration_sampling_service.py:21-25` |
| PYBUG-013 | `InMemoryFeatureBackend` claim/expiry bookkeeping grows without bound (also used by synthetic-data job at 1 M rows) | `in_memory_feature_database.py:19,25-43` |
| PYBUG-014 | Key construction interpolates user-controlled IDs with `:` delimiter — verified collision (`item_id="i:a"` vs `actor_id="b"`) | `online_feature_keyspace_repository.py` (all builders); `common_field_validator.py:5` |
| PYBUG-019 | `response["Body"].read()` (blocking socket read) runs on the event loop outside `to_thread` | `transcribe_batch_transcription_service.py:88-91` |
| PYBUG-023 | Unsynchronised check-then-act on the AMQP channel can orphan a channel | `rabbitmq_channel_integration.py:36-40` |
| PYBUG-024 | Dataset compaction can duplicate feature-log rows after a crash (no manifest; `load_feature_logs` doesn't dedup) | `compact_datasets_job.py:35-42` |
| PYBUG-025 | `LAST_ERROR_HEADER`/attempt headers defined but failure paths never record them — DLQ messages arrive with no cause | `rabbitmq_topology_constant.py:5-7`; settlement code |

### Info (2)

| ID | Title | Location(s) |
|---|---|---|
| PYML-019 | Model admin surface verified read-only: only `GET /v1/models` (HMAC+nonce), no HTTP promote route — shared-secret callers cannot promote models; describe returns in-memory state (stale if reload loop dead) | `model_registry_routes.py:7-8`; `signed_request_middleware.py:46-48` |
| PYML-020 | Hot-swap read/write path verified atomic (copy-on-write dict rebinding, frozen dataclasses) — no mid-swap partial state | `active_model_holder_service.py:16-25,37-38,53` |

---

## 7. Cross-cutting themes (deduplicated)

Several findings share a root cause; fix the root, close the cluster:

| Root cause | Findings |
|---|---|
| **Blocking sync I/O + CPU on the event loop** | PYBUG-001(C) = PYHTTP-001 = PYEVT-004; PYBUG-002; PYBUG-003; PYHTTP-003 (missing deadlines); PYBUG-015 |
| **Fail-open safety decisions** (unavailable → clean) | PYBIZ-001/002/003/004/008/010/015; PYML-004/006; PYHTTP-002 = PYBUG-006; PYBUG-009/010/017 |
| **Background loops unsupervised** (die silently, green health) | PYML-001 = PYBUG-004; PYML-002 = PYBUG-005 = PYML-011; PYEVT-008; PYHTTP-010 |
| **Observability vacuum** (can't debug the above) | PYBUG-022; PYHTTP-014; PYML-015; PYBUG-025 |
| **Claim/lease lifecycle bugs** (CancelledError, release failures, TTL) | PYEVT-002 = PYBUG-007; PYHTTP-004 = PYBUG-008; PYEVT-007; PYEVT-013; PYBUG-021 |
| **Config fails open, not fast** | PYEVT-001 = PYSEC-011; PYSEC-001; PYSEC-010 = PYML-009; PYHTTP-007; PYSEC-003 |
| **PII at rest unmanaged** | PYSEC-002; PYSEC-005/006/007/008; PYML-012 |
| **Model supply chain (pickle RCE)** | PYSEC-009 = PYML-010 (TOCTOU); PYSEC-010 = PYML-009 (unsigned); PYML-003 (unverified activation) |
| **Queue reliability** | PYEVT-003 (SQS no DLQ); PYEVT-005 (side-effect poisons pipeline); PYEVT-006 (requeue loop); PYEVT-009/010/011/012/014/015 |
| **Ads money integrity** | PYBIZ-004 (best-effort spend writes); PYBIZ-005 (overspend race); PYBIZ-006 (reserve zeroed) |

---

## 8. Coverage & blind spots

**Covered:** all 26 modules' routes/controllers/DTOs; middlewares and signature/rate-limit utilities; container/lifespan wiring; messaging layer (AMQP + SQS + publishers + consumers); model registry, promotion, training jobs, parquet sinks; risk/moderation/ads/experiments/eligibility business logic; async patterns, exception handling, resource lifetimes; settings/validators/Dockerfile/.env; automated gates (ruff, mypy strict, pytest, pip-audit).

**Not covered / blind spots:**
- **No runtime testing against real Redis, RabbitMQ, SQS or S3** — tests mock these; failover, reconnect, and timeout behavior under real brokers is unverified.
- **No load/soak testing** — the loop-stall figures (45–55 ms) were measured in isolation; production p99 unknown.
- **Dependency config review** beyond vulnerability audit (lockfile pinning policy, image base tags) not performed.
- **Downstream consumers** of advisory queues (trust service handling of messages that *are* delivered) out of scope — this is the producer side.
- **A stale duplicate worktree** at `.kilo/worktrees/climbing-respect/apps/intelligence` exists and was excluded; if it is deployable it will drift.
- **Coverage gaps found inside the code** are themselves findings: PYML-018 (promotion gate, FeatureLogParquetSink, degraded flags untested).

---

## 9. Prior-findings regression check (SEC-0001…0024, `GO_BACKEND_DEEP_SCAN.md`)

- The prior TypeScript-gateway audit (`FINDINGS.md`) does not cover this service; **no regressions found**. Adjacent notes: SEC-0010 (unsigned gateway identity header) is a TS-gateway concern — this service correctly uses HMAC signing instead. SEC-0001 (forged XFF bypassing rate limits) has a *sibling* here: PYHTTP-006 keys rate limiting on the transport peer with `proxy_headers=False` (safe from spoofing, broken behind a proxy).
- The Go deep scan and this scan are independent surfaces; no ID collisions (PY* prefixes).
- Nothing in this report duplicates a Fixed/Accepted SEC item.

---

## 10. Remediation roadmap

**P0 — this week (safety & integrity holes):**
1. **PYEVT-001/PYSEC-011** — fail startup on unvalidated queue config; ERROR-log every `Null*Publisher`; never report `published=True` from a Null.
2. **PYBUG-001 (+PYHTTP-001, PYEVT-004)** — `asyncio.to_thread` around all Rekognition/boto3 calls; explicit boto3 timeouts.
3. **PYEVT-002 (+PYBUG-007/021, PYHTTP-004, PYBUG-008)** — release claims on `BaseException`/`finally`; shorten the 20-year audio claim TTL.
4. **PYBIZ-001/PYBIZ-002/PYBIZ-006** — non-zero missing-FX rule (or fail closed); image-moderation failure → `review` + log; reserve rate missing → reject.
5. **PYSEC-001** — validator: `server_workers > 1` requires Redis; `SERVER_WORKERS=1` in `.env.example`.

**P1 — next sprint (supervision & observability):**
6. **PYML-001/002 + PYBUG-004/005** — per-iteration try/except + backoff in both loops; task done-callbacks; re-buffer rows on flush failure; expose `dropped_row_count`.
7. **PYBUG-022 + PYHTTP-014** — restore tracebacks in the JSON formatter; `exc_info` in the 500 handler; `LAST_ERROR_HEADER` on settle (PYBUG-025).
8. **PYML-003 + PYSEC-009/010 + PYML-009/010** — verify-before-activate, rollback to `last_good`, single-read pickle load, fail closed on empty signing secret.
9. **PYSEC-002** — retention job for parquet partitions + erasure path; tombstone-first purge (PYSEC-005).
10. **PYEVT-003/005/006** — SQS DLQ/redrive; isolate advisory publishes from the ingest path; attempt-header increment before retry publish.

**P2 — hardening:**
11. Fail-closed floors for degraded scoring across risk/moderation/spam/ads (PYBIZ-003/004/005/008/010/015, PYML-004/006).
12. Move ranking/headline/validation CPU off the loop (PYBUG-002) with a dedicated executor (PYBUG-003).
13. Distributed rate limiting + LRU eviction (PYHTTP-005/006); queue message size cap (PYEVT-010); experiment DTO key validation (PYHTTP-008).
14. Escape markdown/HTML at text boundaries (PYBIZ-013/014); add `self_harm`/`hate` moderation categories (PYBIZ-012).
15. Tests from PYML-018 — promotion gate, sink failure, loop resilience, missing-model `degraded`.

**P3 — hygiene:** remaining Low/Info items (readiness depth PYHTTP-010 = PYEVT-008, canonicalization vectors PYSEC-013, key-segment collisions PYBUG-014, NaN guards PYBUG-017, `now` clamping PYBUG-016, staging-dir GC PYML-016, S3/CLI path handling PYML-017).

---

*Findings: 109 total — 2 Critical (PYEVT-001, PYBUG-001), 22 High, 59 Medium, 24 Low, 2 Info. All IDs PYHTTP/PYSEC/PYEVT/PYML/PYBIZ/PYBUG-NNN are unique to this report.*
