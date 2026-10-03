# Python services

The Python intelligence layer already exists at [`apps/intelligence`](../../apps/intelligence) and is not duplicated here.
It is structured like a Zudojs app (`src/modules/<domain>`, snake_case files with a kind suffix such as
`feed_rank.route.py`) and its HTTP contract is [`apps/intelligence/apiContract.md`](../../apps/intelligence/apiContract.md).

Rules that apply to it (see `platform.decisions` in `docs/architecture/microservicesPlan.json`):

- It returns **scores only**: feed/clip ranking (after a safety and integrity filter), fraud and risk scores, moderation
  classification, analytics. Go and TS services apply a deterministic policy (allow / hold / review / reject) and own the
  final financial or moderation decision.
- It never writes another service's schema. It reads domain events from its own RabbitMQ queue
  (`intelligence-domain-events`) and may read other schemas through the read-only `zudomart_readers` role.
- Callers sign requests with HMAC and fall back to deterministic logic when it is slow or down.

Moving it to `services/python/intelligence` is a follow-up (`git mv` plus its Dockerfile and CI paths); new Python
services (data pipelines, AI classifiers) go in `services/python/<name>` with the same layout and `uv`.
