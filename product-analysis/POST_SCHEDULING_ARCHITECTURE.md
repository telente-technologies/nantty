# Post scheduling: current design and paid-feature proposal

> **Updated 2026-10-29:** Founder-approved target rules supersede the queue-cap proposal below: scheduling is paid-only for eligible Blue Basic, Blue Premium, Gold Basic and Gold Premium accounts; each tier has an unlimited queue and a 90-day maximum horizon. There are no daily/monthly subscription quotas or queue-count caps. Existing accepted schedules survive subscription expiry. Black Government has no special scheduling entitlement. See [FINAL_SUBSCRIPTION_SPEC.md](FINAL_SUBSCRIPTION_SPEC.md).

Audit date: 2026-10-29. Scheduling is implemented, and source now enforces paid entitlement on creation and rescheduling. This is source/test evidence, not proof of a live deployment or full end-to-end verification.

## Current implementation (repository state, 2026-10-29)

- Create: `POST /api/v1/posts` accepts `scheduledAt` (authenticated, idempotent request); regular feed posts only, not clips/comment replies.
- List: `GET /api/v1/posts/scheduled`; owner-scoped cursor pagination, default 20/max 50 per page.
- Reschedule: `PATCH /api/v1/posts/:postId/schedule`; owner lookup plus a profile-bound paid entitlement check before the atomic status update.
- Publish now: `POST /api/v1/posts/:postId/schedule/publish-now`.
- Cancel: `DELETE /api/v1/posts/:postId/schedule`.
- Validation: explicit future ISO date/time with timezone/offset required, at least one minute ahead, at most 90 days ahead. Media ownership is checked through normal create flow; publisher waits for media readiness.
- Persistence: `PostPublicationState` and `scheduledAt` in `services/typescript/social/prisma/schema/content.prisma`, with migration `services/typescript/social/prisma/migrations/20261029140000_scheduled_posts/migration.sql`.
- Worker: `services/typescript/social/src/jobs/publishScheduledPosts.job.ts`, wired from `services/typescript/social/src/app.ts`, polls every 15 seconds. It uses transactional state changes/outbox publication to avoid duplicate publish effects. Unready media waits; hard failures/aged processing or unavailable author/profile mark the item failed for manual action.

Creation and rescheduling now require a paid Blue/Gold plan on the exact posting profile. A missing entitlement service or non-OK response fails closed. Free accounts can still cancel or publish already-accepted scheduled posts. This is source/test evidence only, not proof of a live deployment.

## Current gaps

1. No dedicated edit-content/media endpoint for scheduled posts was found; reschedule/publish-now/cancel exist.
2. Failure handling marks posts failed, but does not implement exponential retry/backoff after publication failure; owner must repair/reschedule.
3. `scheduledAt` is stored as UTC instant; timezone/offset input is validated but a user’s IANA timezone preference is not preserved for later display across daylight-saving changes.
4. Publication-time content moderation recheck and automatic retry/lease recovery are not fully implemented/verified.
5. Cursor pagination is implemented and exposed to the mobile manager; end-to-end visual QA on device remains pending.

## Recommended API and data behavior

- Keep server authoritative: creation checks current paid entitlement, account/profile ownership, schedule horizon and platform-wide anti-spam protections. Repeat entitlement checks on reschedule; never trust frontend plan state. No subscription-specific queue count or daily/monthly quota exists.
- Persist `scheduled_at_utc` and the user’s IANA `time_zone` (plus original local wall time only if required for explicit DST behavior). UI should make local zone visible and ask users to resolve ambiguous/nonexistent DST times.
- Scheduled post content/media should use the existing post/media ownership model. Use immutable idempotency key/publication identifier and a unique constraint/outbox key to prevent duplicate feed delivery during retries.
- Worker should claim due items atomically (`scheduled -> publishing`) with lease/timeout recovery. Retry transient provider/DB failures with bounded exponential backoff and jitter; permanently invalid/unsafe content should fail and notify. Re-run moderation/visibility checks at publication time.
- Expose cursor-paginated list, edit body/media, reschedule, cancel and publish-now operations. Every operation must constrain by author account and linked profile ownership. Do not add a per-tier queue cap. The existing list now has cursor pagination; edit body/media remains open.
- Record audit events for changes and publish attempt outcomes without leaking private content into logs.

## Founder-approved scheduling limits

| Plan | Maximum queued | Maximum future horizon | Entitlement |
|---|---:|---:|---|
| Blue Basic | Unlimited | 90 days | Paid entitlement required for new schedules/reschedules |
| Blue Premium | Unlimited | 90 days | Same scheduling limits as Basic |
| Gold Basic | Unlimited | 90 days | Paid entitlement required for new schedules/reschedules |
| Gold Premium | Unlimited | 90 days | Same scheduling limits as Basic |

The 90-day horizon is the subscription feature limit; platform-wide anti-spam, safety and technical rate limits still apply. Large queues require cursor pagination. Bind entitlements to the correct paid account/profile; never inherit Gold access from an unrelated business profile.

## Expiration/upgrade policy

- Upgrade: paid scheduling entitlement becomes available only after authoritative purchase state is verified; all commercial tiers share the same queue capacity and horizon.
- Downgrade/expiration: preserve already accepted scheduled posts and allow them to publish; block new scheduling and rescheduling until an eligible current paid plan exists. Do not delete or silently cancel accepted work.
- Eligibility is checked when scheduling; do not retroactively cancel valid queued content solely because billing expires. If business policy chooses cancellation instead, notify users well in advance and obtain explicit approval.

## Test plan before release

Test owner and cross-account IDOR, paid vs free API calls, expired/grace subscription boundary, linked profile/store ownership, platform anti-spam limits, DST transitions, media still-processing and permanently failed, worker restart/lease recovery, duplicate worker runs, transient errors/retries, moderation change before send, cancel/reschedule races, and exactly-once outbox/feed effects.
