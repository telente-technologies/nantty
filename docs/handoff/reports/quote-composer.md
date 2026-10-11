# Quote opens the full composer, and quotes show up in the comment section

## Backend (services/typescript/social)
- `GET /posts/:id/comments` and `GET /posts/:id/thread` (sort=relevant) now return typed items. Comments have `type:"comment"`. Quote posts of this post appear as `type:"quote"` items with `{id, postId, quotePost (summary), likes, commentCount, isPostAuthor, createdAt}`.
  - Quotes are ranked into the same comment snapshot (keys `q:<id>`, so no migration). They use the same tiering and engagement/recency score. The cursor and paging are unchanged, and the tail count ignores quote keys.
  - Visibility is re-checked on every page: blocked, private, followers-only, subscriber-only, withheld labels, deleted and hidden. A deleted quote drops out mid-paging.
  - `filter=quotes` returns only quotes, newest first, with a uuid cursor. A bad cursor gives 400 CURSOR_EXPIRED.
  - `latest`/`likes` thread sorts stay replies-only.
  - No new notifications or events: the existing quote notification is reused, the mute is untouched, and there is no double notify.
- New `DELETE /posts/:id/repost` (undo plain repost; idempotent 204; reuses deletePost). PostView gains viewer `reposted`.
- Files: `modules/comments/{services/conversationQuotes.service.ts, repositories/conversationQuotes.repository.ts, services/rankedConversation.service.ts, queries/*, validators, controllers, models}`, `modules/posts/{commands/undoRepost/*, postView.service.ts, post.repository.ts, routes, controller, module}`, `feeds/services/sponsoredInsertion.service.ts` (reposted:false).
- Tests: new `tests/comments/conversationQuotes.test.ts` covers ordering, visibility, paging, deletion mid-paging, snapshot reuse and the Quotes filter. `tests/posts/reshareIntegrity.test.ts` adds undo repost and the `reposted` flag. Gateway route test adds thread and repost routes. I adjusted the typing in commentRanking and pins.integration tests.

## Mobile
- The `ReshareSheet` is now a small sheet with Repost / Undo repost (Repeat icon) and Quote (new `Quotes24Icon` in the icon registry; the icon count test is now 185). Quote navigates to `CreatePost {mode:"post", quotePostId}`. Deep link: `create/post?quotePostId=<id>` (test added).
- `CreatePost`:
  - The quote card is pre-attached through `useQuotedPostPreview(text, quotePostId)` and can be removed. Removing it then re-pasting the link attaches it again.
  - The title reads "Quote".
  - The card also shows on the settings ("Next") step.
  - Publishing sends explicit `quotedPostId`.
  - Drafts store `quotedPostId` and restore it.
  - If the quoted post is unavailable, publishing is blocked with "The post you're quoting isn't available anymore. Remove it to post." A server 422 QUOTED_POST_UNAVAILABLE refetches the card.
  - Double tap is guarded with a ref in `usePublishPost`; the clip composer uses it too.
- Comment section: Replies | Quotes chips with the quote count, and a "Quoted this post" row that opens the quote post. This is on post detail (the feed's comments open post detail) and in clip comments (`ThreadedCommentList`).
- Mocks for comments, thread, repost/undo and the delete counters are updated. New `mocks/commentSectionQuotes.mock.ts`.
- Tests: `contracts/commentSectionQuotes.test.ts`, `components/feed/__tests__/quotedPostPreview.hook.test.ts`, plus additions to `usePostInteractions` and linking.

## Webapp
- The repost button in `PostActions` opens `ReshareDialog` (Repost / Undo repost / Quote). Quote goes to `/post/new?quote=<id>`, which renders `PostComposer` with the quote attached. Quote drafts are kept in their own localStorage slot so they never overwrite the normal draft. The quote id is validated. Unavailable quotes block publishing. The layout grouping in `postActions.tsx` was kept.
- Replies | Quotes tabs with the quote count and quote rows appear in `ConversationPanel` (post detail), `CommentsPanel` (watch) and the clip comments sheet. The shared hook is `commentSection.hook.ts`.
- Mocks are updated: the composer resolves quotes like the server (422 QUOTED_POST_UNAVAILABLE, trailing link stripped), and repost/undo/delete counters, seeded quotes, comments and thread are covered. The parity test now expects QUOTED_POST_UNAVAILABLE, which matches the server.
- Tests: `contracts/commentSectionQuoteMocks.test.ts` and `utils/composerDraft.util.test.ts` additions.

## Contracts and docs
- `packages/contracts/src/posts.contract.ts`: QuoteThreadItemContract, filter, repost state/path.
- `docs/verification/apiContractCheck.md`: rows for comments, thread, repost and the new DELETE repost.
- asyncapi is unchanged because no events changed.

## QA results
- social: tsc (src and tests) clean, vitest 450 passed / 4 skipped, eslint clean on the changed modules. Gateway route test passes (98).
- mobile: tsc clean. Jest on contracts, feed, clips, create, hooks, navigation, icons, posts/create screens and mocks: 25 suites, 130 tests, all pass.
- webapp: tsc clean, units 208 pass, contracts 97 pass.
- Adversarial checks covered by tests:
  - double-tap Publish (ref guard)
  - quoting your own post, and quoting a quote (one level)
  - removing the card and re-pasting the link
  - the quoted post deleted while composing (422, card goes unavailable)
  - repost idempotency and undo
- Back navigation and offline publish use the existing composer paths: state is kept on error, and the webapp already blocks publishing offline. These were not exercised on a device.

## Notes and leftovers
- The clip rail has no repost button today, so quoting a clip is only possible by pasting a link. I didn't add a rail button because the rail was just reorganised.
- The mobile `ViewQuotesLink` is no longer used on post detail (the Quotes tab replaces it). The `PostQuotes` screen still exists.
- A quote made by the post's own author ranks in the "author" tier, like their comments.
- Quotes beyond the 300 ranked candidates show only in the Quotes tab.
- Nothing committed.
