# ts.notifications consumed events

Queue `notifications-domain-events` (RabbitMQ quorum queue bound to `zudomart.events`, envelope.v1; bindings in `infra/local/rabbitmq/topology.json`). Handlers key on the exact `type`. R = required, O = optional (email skipped or default used when absent). Producers marked "published" use the schema in `../schemas`; "unpublished" lists the fields read until the owning agent publishes.

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
| escrow.refunded, escrow.partiallyRefunded | goMoney | R buyerUserId, orderId, escrowId, refunded; email needs orderNumber; O refundMethod, reason, itemName |
| dispute.opened | goMoney | R buyerUserId, sellerUserId, disputeId, orderId; email needs caseNumber, orderNumber, amount, reason, respondBy; O openedBy |
| disputeMessage.posted | goMoney | R buyerUserId, sellerUserId, disputeId, authorUserId; email needs caseNumber, orderNumber, amount, message; O authorName, stage, actionNeededBy |
| dispute.resolved | goMoney | R buyerUserId, sellerUserId, disputeId; email needs caseNumber, orderNumber, amount, outcome, buyerRefund, sellerPayout, summary |
| payment.failed | goMoney | R ownerUserId, paymentId, amount, provider; O description, paymentMethod, reason, retryUrl |
| payment.succeeded | goMoney | R ownerUserId, paymentId, purpose (in-app for wallet_top_up, creator_subscription only) |
| coinPurchase.completed | goMoney | R userId, coinPurchaseId, coins, source, amount; web email needs receiptNumber, balanceAfter; O packName, bonusCoins, paymentMethod, paidAt |
| payout.completed / payout.failed | goMoney | R userId, withdrawalId, amount; completed needs reference for email; O payeeKind (seller\|creator), bankAccountLabel, sentAt, reason, retryAt |
| withdrawal.requested/approved/failed/cancelled | goMoney | R userId, withdrawalId (in-app only) |
| adReport.ready | goAds | R scheduledReportId, accountId, reportName, recipients[] (plain email addresses, email each one), frequency, periodFrom, periodTo, currency, spendMinor, impressions, clicks; O csvUrl, pdfUrl, urlsExpireAt (links expire, do not store) |
| gift.sent | goLive | R receiverUserId, liveId; O quantity, totalCoins, sender{id,name,username,avatarUrl} |
| live.started | goLive | R title, liveId, hostName, hostHandle, host{id,name,username,avatarUrl}, notifyUserIds[] (opted-in unblocked followers, at most 1000; notifyTruncated marks more), isShopping, viewerCount, visibility, notifyAudience, startedAt; O emailUserIds[], liveUrl, coverUrl (schema `live.started.v1.json`) |
| review.created | goCommerce | R storeOwnerAccountId; O rating, storeName, reviewId. Seller category: in-app + push "New review" linking to the dashboard reviews page |
| review.replied | goCommerce | R authorAccountId, storeId, reviewId; O storeName, productId, firstReply (false = an edit, nothing sent). In-app + push to the reviewer |
| sellerApplication.reviewed | goCommerce | R accountId, applicationId, decision (`approved`\|`rejected`); O storeName, reason. Seller category: in-app + push |
| creator.standingChanged | goMoney | R userId, status (`approved`\|`suspended`); O reason. Creator category: in-app + push (unpublished schema) |
| message.sent | ts-social | R conversationId, pushRecipients[{userId, showPreview}]; O conversationKind, conversationTitle, senderName. Push only, never message content (E2EE); `showPreview: false` hides the sender and group name. Events without `pushRecipients` are dropped |

## Schemas added in `../schemas` (unpublished before)
otp.issued, signIn.newDeviceDetected, twoFactor.enabled (goIdentity); checkmark.suggested|applicationSubmitted|approved|rejected|revoked|renewalFailed, creatorApplication.submitted|approved|needsReview|ineligible, sellerDocuments.submitted|approved|rejected (goIdentity); planTrial.started|ending|converted, planInvoice.paymentFailed|paid, cardVerification.refunded, subscriptionTrial.ending, subscriptionRenewal.upcoming, subscriptionInvoice.paid, subscriptionPayment.failed, subscriptionGrace.ending, subscription.downgraded, subscriptionCard.expiring, subscriptionPrice.changeNotice, payoutAccount.created|verified|creationFailed|actionRequired, paymentRefund.bankDetailsRequired (goMoney). Fields exactly as in each schema (R = schema `required`).

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
| mention.created | social | R recipientUserId, actor{id,name}, excerpt, url; O surface, mentionedEveryone |
| post.tagged | social | R recipientUserId, actor{id,name}, postId, kind (post or clip); O taggedUserId, authorId, url |
| follow.created, followRequest.created, messageRequest.received, videoReply.created | social | R recipientUserId, actor{id,name}; O url |
| comment.created | social | R recipientUserId, actor; O target, excerpt, url |
| post.reshared | social | R originalAuthorId, authorId, postId, originalPostId, isQuote, actor{id,name}; O surface (post or comment), commentId, url. Self-quotes are skipped. In-app + push |
| any social event with `notificationsMuted: true` | social | Dropped without a notification: the recipient turned off notifications for that post (comment.created, mention.created, videoReply.created, post.tagged, post.reshared, post.liked, comment.liked, comment.pinned) |

## Digest source (social internal API, not an event)
`GET /api/v1/internal/digests/{weekly|followRequests|messageRequests}?cursor=&limit=` returns `{data:[{userId, props}], nextCursor}`; props are the template props without firstName.
