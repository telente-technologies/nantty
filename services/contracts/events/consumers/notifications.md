# ts.notifications consumed events

Queue `notifications-domain-events` (RabbitMQ quorum queue bound to `nantty.events`, envelope.v1; bindings in `infra/local/rabbitmq/topology.json`). Handlers key on the exact `type`. R = required, O = optional (email skipped or default used when absent). Producers marked "published" use the schema in `../schemas`; "unpublished" lists the fields read until the owning agent publishes.

> **Order-group events are wired (2026-10-22).** goCommerce publishes `orderGroup.created`, `orderGroup.paid`, `orderGroup.statusChanged`, `orderGroup.shipped`, `orderGroup.delivered` and `orderGroup.completed`. `notifications-domain-events` is bound to all six, and `eventMappingRegistry.ts` maps them to in-app, push and email. Producer payloads now include the seller name, buyer name, line items, shipping, payment mode and lifecycle timestamps, so buyer emails can render `orderPlaced`, `paymentConfirmed`, `orderShipped`, `orderDelivered` and `orderCompleted`, and sellers get `sellerNewOrder` on payment. The legacy `order.*` mappings remain for the checkout shell; only `order.cancelled` currently has a producer, and its checkout-shell payload (checkoutId/reason/status only) is intentionally ignored.

## Order-group lifecycle (published)
| Type | Producer | Fields |
| --- | --- | --- |
| orderGroup.created | goCommerce | R orderGroupId, checkoutId, storeId, buyerAccountId, sellerAccountId, orderNumber, totalMinor, currency; O sellerName, buyerName, paymentMode, subtotalMinor, discountMinor, storeCreditMinor, shippingMinor, refundedMinor, shippingMethod, status, items[], payBy. In-app + email `orderPlaced` to buyer |
| orderGroup.paid | goCommerce | R orderGroupId, orderNumber, orderedAt, checkoutId, storeId, sellerAccountId, buyerAccountId, subtotalMinor, totalMinor, currency, attributedItems; O sellerName, buyerName, paymentMode, discountMinor, storeCreditMinor, shippingMinor, refundedMinor, shippingMethod, status, items[], paidAt. In-app + push to buyer and seller; buyer email `paymentConfirmed`, seller email `sellerNewOrder` |
| orderGroup.statusChanged | goCommerce | R orderGroupId, reference, from, to, actorKind, buyerAccountId, sellerAccountId. `processing` and `ready` notify the buyer; `cancelled` notifies buyer and seller. `shipped`, `delivered` and `completed` are ignored here so the dedicated events are not duplicated |
| orderGroup.shipped | goCommerce | R orderGroupId, occurredAt; O orderNumber, storeId, sellerAccountId, buyerAccountId, sellerName, buyerName, paymentMode, currency, subtotalMinor, discountMinor, storeCreditMinor, shippingMinor, totalMinor, refundedMinor, shippingMethod, status, items[], courierName, trackingNumber, trackingUrl, shippedAt, estimatedDeliveryAt. In-app + push + email `orderShipped` to buyer |
| orderGroup.delivered | goCommerce | R orderGroupId, occurredAt; O orderNumber, storeId, sellerAccountId, buyerAccountId, sellerName, buyerName, paymentMode, currency, subtotalMinor, discountMinor, storeCreditMinor, shippingMinor, totalMinor, refundedMinor, shippingMethod, status, items[], courierName, trackingNumber, trackingUrl, deliveredAt, confirmBy. In-app + push + email `orderDelivered` to buyer |
| orderGroup.completed | goCommerce | R orderGroupId, orderNumber, orderedAt, storeId, sellerAccountId, buyerAccountId, subtotalMinor, totalMinor, refundedMinor, currency, completedAt, attributedItems; O sellerName, buyerName, paymentMode, discountMinor, storeCreditMinor, shippingMinor, shippingMethod, status, items[]. In-app + email `orderCompleted` to buyer |

## Published schemas (fields read)
| Type | Producer | Fields |
| --- | --- | --- |
| copyrightClaim.warningIssued | goTrust | R claimId, targetType, targetId, infringerId, deadlineAt; O workTitle, reason. Trust category: in-app + push + email `copyrightWarning` with the countdown |
| copyrightClaim.audioMuteOrdered | goTrust | R claimId, targetType, targetId, infringerId; O workTitle, reason. In-app + email `audioMuted` (counter-notice rights) |
| copyrightClaim.contentTakenDown | goTrust | R claimId, targetType, targetId; O infringerId (nothing sent without it), strikeId, workTitle, reason. In-app + push + email `contentTakenDown` |
| copyrightClaim.counterNoticeReceived | goTrust | R claimId, restoreEligibleAt; O claimantUserId (nothing sent without it), claimantEmail (email address override), workTitle. Email `counterNoticeReceived` to the claimant |
| copyrightClaim.restored | goTrust | R claimId, targetType, targetId; O infringerId, remedy (audio_muted = sound restored), workTitle. In-app + email `contentRestored` |
| strike.issued | goTrust | R accountId, kind (warnings are skipped), expiresAt, activeStrikeCount; O source, policy. In-app + email `strikeIssued` |
| strike.expired | goTrust | R accountId, kind (warnings are skipped), activeStrikeCount; O source, policy. In-app + email `strikeExpired` |
| account.registered | goIdentity | R accountId, username |
| account.passwordChanged | goIdentity | R accountId; O device, location, ipAddress |
| session.revoked | goIdentity | R accountId, reason; O sessionCount |
| session.refreshTokenReuseDetected | goIdentity | R accountId; O sessionCount |
| account.anniversaryReached | goIdentity | R accountId, years, localDate, joinedAt; O timezone, stats.posts, stats.lives, stats.followers, stats.orders. Milestones category, email + in-app |
| account.deletionRequested | goIdentity | R accountId, scheduledFor; O cancelUrl, openOrders |
| account.deletionExecuted | goIdentity | R accountId, executedAt; O finalEmail (no email without it), referenceId |
| dataExport.completed | goIdentity | R accountId, exportId, completedAt, expiresAt, sizeBytes; O downloadUrl, requestedAt |
| policyVersion.published | goIdentity | R kind, version, effectiveAt, publishedBy; O versionId, documentKey, documentTitle, changeSummary, whatChanged[], isMaterialChange |
| escrow.held | goMoney | R buyerUserId, orderId, escrowId; email also needs orderNumber, groups[], releaseRule |
| escrow.released | goMoney | R sellerUserId, orderId, escrowId, amount, commission, releasedToSeller; email needs orderNumber; O paymentFee, availableAt, releasedBecause |
| escrow.refunded, escrow.partiallyRefunded | goMoney | R buyerUserId, orderId, escrowId, refunded; email needs orderNumber; O refundDestination (wallet, the default, or paymentMethod), reason, itemName |
| escrow.refundScheduled | goMoney | R buyerUserId, sellerUserId, orderId, escrowId, pendingRefund; O orderNumber, reason. In-app only, to buyer and seller |
| dispute.opened | goMoney | R buyerUserId, sellerUserId, disputeId, orderId; email needs caseNumber, orderNumber, amount, reason, respondBy; O openedBy |
| disputeMessage.posted | goMoney | R buyerUserId, sellerUserId, disputeId, authorUserId; email needs caseNumber, orderNumber, amount, message; O authorName, stage, actionNeededBy |
| dispute.sellerResponseOverdue | goMoney | R buyerUserId, sellerUserId, disputeId, orderId; in-app + push only (the dispute moved to staff review after the 48-hour seller window) |
| dispute.resolved | goMoney | R buyerUserId, sellerUserId, disputeId; email needs caseNumber, orderNumber, amount, outcome, buyerRefund, sellerPayout, summary |
| payment.failed | goMoney | R ownerUserId, paymentId, amount, provider; O description, paymentMethod, reason, retryUrl |
| payment.succeeded | goMoney | R ownerUserId, paymentId, purpose (in-app for wallet_top_up, creator_subscription only) |
| coinPurchase.completed | goMoney | R userId, coinPurchaseId, coins, source, amount; web email needs receiptNumber, balanceAfter; O packName, bonusCoins, paymentMethod, paidAt |
| payout.completed / payout.failed | goMoney | R userId, withdrawalId, amount; completed needs reference for email; O payeeKind (seller\|creator), bankAccountLabel, sentAt, reason, retryAt |
| withdrawal.requested/approved/failed/cancelled | goMoney | R userId, withdrawalId (in-app only) |
| adReport.ready | goAds | R scheduledReportId, accountId, reportName, recipients[] (plain email addresses, email each one), frequency, periodFrom, periodTo, currency, spendMinor, impressions, clicks; O csvUrl, pdfUrl, urlsExpireAt (links expire, do not store) |
| gift.sent | goLive | R receiverUserId, liveId; O quantity, totalCoins, sender{id,name,username,avatarUrl} |
| post.created | ts-social | R postId, authorId, kind, visibility; O isVideoReply, authorProfileId. Only public `post`/`clip` posts by the personal profile fan out (no stories, video replies, subscriber-only or business-profile posts): a `postNotifications.fanout` job pages `GET /api/v1/internal/post-notification-subscribers/:authorId?scope=posts` on social 200 at a time and sends in-app + push "@username posted a new clip" (social category, deep link `/clips/:id` or `/post/:id`) to followers whose bell is `posts` or `posts_and_lives`. Blocked pairs are filtered by social; each page passes `postId` so paging stops once the post is deleted or removed; a finished page job is not re-run on redelivery; the author is never notified |
| live.started | goLive | R title, liveId, hostName, hostHandle, host{id,name,username,avatarUrl}, notifyUserIds[] (opted-in unblocked followers, at most 1000; notifyTruncated marks more), isShopping, viewerCount, visibility, notifyAudience, startedAt; O emailUserIds[], liveUrl, coverUrl (schema `live.started.v1.json`). Also queues a `postNotifications.fanout` job (scope `lives`) that alerts every follower whose bell is `posts_and_lives`, beyond the 1000 cap, with "@username is live: <title>" (deduped per event and recipient with notifyUserIds; skipped for subscriber-only lives) |
| live.reminderDue | live reminder sweep (15 minutes before a scheduled live) | R liveId, title, scheduledAt, notifyUserIds[] (same audience rules as live.started, at most 1000); O hostName, host{id,name,username,avatarUrl}, hostHandle, notifyTruncated (schema `live.reminderDue.v1.json`). In-app and push only, category `live`: "<hostName> goes live in N minutes" with data {liveId, scheduledAt, url} |
| review.created | goCommerce | R storeOwnerAccountId; O rating, storeName, reviewId. Seller category: in-app + push "New review" linking to the dashboard reviews page |
| review.replied | goCommerce | R authorAccountId, storeId, reviewId; O storeName, productId, firstReply (false = an edit, nothing sent). In-app + push to the reviewer |
| sellerApplication.reviewed | goCommerce | R accountId, applicationId, decision (`approved`\|`rejected`); O storeName, reason. Seller category: in-app + push |
| creator.standingChanged | goMoney | R userId, status (`approved`\|`suspended`); O reason. Creator category: in-app + push (unpublished schema) |
| message.sent | ts-social | R conversationId, pushRecipients[{userId, showPreview}]; O conversationKind, conversationTitle, senderName. Push only, never message content (E2EE); `showPreview: false` hides the sender and group name. Events without `pushRecipients` are dropped |

## Schemas added in `../schemas` (unpublished before)
otp.issued, signIn.newDeviceDetected, twoFactor.enabled (goIdentity); checkmark.suggested|applicationSubmitted|approved|rejected|revoked|renewalFailed, creatorApplication.submitted|approved|needsReview|ineligible, sellerDocuments.submitted|approved|rejected (goIdentity); planTrial.started|ending|converted, planInvoice.paymentFailed|paid, cardVerification.refunded, subscriptionTrial.ending, subscriptionRenewal.upcoming, subscriptionInvoice.paid, subscriptionPayment.failed, subscriptionGrace.ending, subscription.downgraded, subscriptionCard.expiring, subscriptionPrice.changeNotice, subscriptionOffer.sent (to a raw email, may be a non-user), payoutAccount.created|verified|creationFailed|actionRequired, paymentRefund.bankDetailsRequired (goMoney). Fields exactly as in each schema (R = schema `required`).

## Owned by other agents (not published here)
| Type | Producer | Fields read |
| --- | --- | --- |
| order.placed | goCommerce | R orderId, orderNumber, buyerUserId, groups[]{sellerUserId, sellerName, items[], shipping}, payBy, paymentUrl |
| order.paid | goCommerce | R as above + paymentMethod, buyerName, acceptBy; O paidAt, paymentMode |
| order.sellerAccepted / sellerRejected | goCommerce | R order base + shipBy / reason, refund; O sellerName, refundMethod |
| order.shipped | goCommerce | R order base + carrier, trackingNumber, trackingUrl, estimatedDelivery |
| order.delivered | goCommerce | R order base + confirmBy; O deliveredAt, confirmUrl, disputeUrl |
| order.completed | goCommerce | R order base; O reviewUrl |
| order.cancelled | goCommerce | R order base + reason; O cancelledBy, refund, refundMethod, restocked |
| account.restricted / suspended / banned, appeal.decided, report.closed | goTrust | R accountId (reporterUserId for report.closed), caseId, reason, policy, policyUrl, appealUrl + restrictions[], until / appealBy, deletionAt; appeal: outcome, explanation; report: reportId, reportedWhat, outcome, reportedAt |
| account.warned | goIdentity (via goTrust WARN_AUTHOR / WARN_USER) | R accountId, reason, policy, policyUrl, appealUrl; O caseId (report id), source. In-app + push only, no email template |
| mention.created | social | R recipientUserId, actor{id,name}, excerpt, url; O surface, mentionedEveryone, commentId (stored for comment mentions) |
| post.tagged | social | R recipientUserId, actor{id,name}, postId, kind (post or clip); O taggedUserId, authorId, url |
| follow.created, followRequest.created, followRequest.accepted, messageRequest.received, videoReply.created | social | R recipientUserId, actor{id,name}; O url. follow.created with viaRequest=true (an accepted request or a private→public switch) sends nothing; followRequest.accepted goes to the requester. follow.rejected has no mapping, so a decline never notifies |
| comment.created | social | R recipientUserId, actor; O target, excerpt, url, commentId (stored so the notification can be withdrawn) |
| comment.hidden / comment.unhidden | social | R commentId. No notification: in-app notifications of that comment (comment.created and comment mentions, matched by stored commentId or a `?comment=<id>` link) get `hiddenAt` set or cleared, so they leave and rejoin the inbox and unread count. Push already sent is not recalled |
| post.deleted | social | R postId. No notification: notifications pointing at the post are deleted |
| post.reshared | social | R originalAuthorId, authorId, postId, originalPostId, isQuote, actor{id,name}; O surface (post or comment), commentId, url. Self-quotes are skipped. In-app + push |
| any social event with `notificationsMuted: true` | social | Dropped without a notification: the recipient turned off notifications for that post (comment.created, mention.created, videoReply.created, post.tagged, post.reshared, post.liked, comment.liked, comment.pinned) |

## Digest source (social internal API, not an event)
`GET /api/v1/internal/digests/{weekly|followRequests|messageRequests}?cursor=&limit=` returns `{data:[{userId, props}], nextCursor}`; props are the template props without firstName.
