# Python services

The Python intelligence layer lives at [`services/python/intelligence`](intelligence).
It is structured like the TypeScript service architecture (`src/modules/<domain>`, snake_case files with a kind suffix such as
`feed_rank.route.py`) and its HTTP contract is [`services/python/intelligence/apiContract.md`](intelligence/apiContract.md).

Rules that apply to it (see `platform.decisions` in `docs/architecture/microservicesPlan.json`):

- It returns **scores only**: feed/clip ranking (after a safety and integrity filter), fraud and risk scores, moderation
  classification, analytics. Go and TS services apply a deterministic policy (allow / hold / review / reject) and own the
  final financial or moderation decision.
- It never writes another service's schema and does not read product schemas directly. It reads domain events
  from its own RabbitMQ queue (`intelligence-domain-events`); callers send candidates and features over HTTP,
  and the product service applies the decision.
- Callers sign requests with HMAC and fall back to deterministic logic when it is slow or down.

New Python services (data pipelines, AI classifiers) go in `services/python/<name>` with the same layout and `uv`.
