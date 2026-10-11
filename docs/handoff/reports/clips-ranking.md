# Clips For You / Following + Python clip ranking

## Python findings (before)
- `/v1/clips/rank` already consumed the clip_watched online stats (`watches`, `completions`, `rewatches`, `watch_fraction_sum`, keyed by raw clip id). Field names matched the event_feature_update_service writes, and the ids line up because social sends raw post ids and Python hashes actor/author ids with the same HMAC as social.
- What was missing: no likes/shares signal, no integrity discount, no checkmark boost or caps, no explanations, ignored `isSensitive`, and no non-personalized mode. Feed ranker (`/v1/feed/rank`) had all of these.
- Social's feed ranker sent the real hashed viewer id even when personalization consent was off, so Python personalized it anyway. Fixed: it now sends `guest`.

## Python changes (services/python/intelligence)
- `modules/clips/dtos/clip_ranking_dto.py`: these candidate fields are optional (backward compatible): like/comment/share/saveCount, authorTier, authorIsOfficial, integrity, isPromoted, ageRestricted. Request gains personalized, boostPolicy, trendingTopics. Response gains explanations, boostMultiplier, trustedEngagementShare, manipulatedItemIds, boostPolicyVersion.
- New `services/clip_fairness_service.py` covers the safety filter, the integrity assessment and discount (score x (0.3 + 0.7 x trusted share)), an engagement signal (capped at +25%), the capped boost (it reuses the hard caps 15/12/10/8/5, Official 15, 25 total) and the explanations.
- New `services/clip_exploration_order_service.py` holds the moved merge/exploration code. Manipulated clips never get exploration slots.
- `clip_ranking_service.py`: the new scoring, and `personalized: false` skips viewer features, seen items and feature logging.
- Tests: `tests/modules/clips/test_clip_ranking_signals.py` (12 tests) and the fixture `fixtures/social_clip_rank_request.json`.

## Social changes (services/typescript/social)
- `integrations/intelligenceClipRanker.integration.ts`: the same signing, hashing, timeout, breaker and fallback pattern as the feed ranker. It uses the shared `createSignedIntelligenceRanker`, which was extracted from the feed ranker.
- `integrations/deterministicClipRanker.integration.ts`: the fallback ranker, which also uses completion.
- `modules/feeds/services/clipsForYou.service.ts`: snapshot paging through the new `FeedRankSnapshot` table (`feed_rank_snapshots`, migration `20261011090000_feed_rank_snapshots`, 6 h lifetime), with re-checks on each page, `CURSOR_EXPIRED` and stored disclosures.
- `rankedFeed.service.ts`: `rankFeedCandidates` was extracted and now takes optional watch totals (`post_daily_stats` videoViews and completedViews), plus duration and topics. Posts behave as before.
- Following clips: accepted follows only (own clips excluded), newest first, and an empty page short-circuits.
- `app.ts` wires `clipRanker`. `.env.example` sets INTELLIGENCE_URL=http://127.0.0.1:8090 and the local-only shared secret that matches the Python `.env.example`. startSandboxStack.sh already starts intelligence on 8090 and social reads `.env.example`, so it needed no change.
- Tests: `tests/ranking/intelligenceClipRanker.test.ts`, which includes a cross-language fixture equality check, and `tests/feeds/clipsTabs.test.ts`.

## QA
- social: tsc (src and tests) passes, eslint on the touched files is clean, and vitest passes (59 files, 372 tests).
- Python: ruff passes, mypy passes (569 files), and the full pytest suite passes.
- e2e: I ran Python intelligence (.env.example) and drove social's real clip ranker client against it. I published 40 social-shaped `clip.watched` envelopes (built by `interactionEventFor`) to RabbitMQ, where the Python consumer picked them up. The order went from [1,2,0] to [2,1,0] with zero fallbacks.

## Not done / follow-ups
- I did not run the full social→DB e2e. The local social schema has 6 other agents' unapplied migrations (including grant_widget_reads), and I did not apply them. Run `prisma migrate deploy` before using the clips tab locally.
- The platform has no account-mute feature, so only blocks and "not interested" topic demotion apply.
- The Python consumer only updates in-memory features unless INTELLIGENCE_REDIS_URL is set. Production needs Redis.
