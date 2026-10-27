import { createCipheriv } from "node:crypto";

export const testOtpKey = Buffer.alloc(32, 9);
const sealedOtp = (code: string): string => {
  const nonce = Buffer.alloc(12, 3);
  const cipher = createCipheriv("aes-256-gcm", testOtpKey, nonce);
  const body = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, body, cipher.getAuthTag()]).toString("base64");
};

const money = (amountMinor: number) => ({ amountMinor, currency: "NGN" });

const groups = [{
  sellerUserId: "seller1", sellerName: "Glow by Zainab", sellerVerified: true, shipping: money(150000), shippingMethod: "GIG Logistics",
  items: [{ name: "Vitamin C Glow Serum", quantity: 2, unitPrice: money(850000), imageUrl: "https://cdn.nantty.com/p/serum.jpg" }],
}];

const order = { orderId: "o1", orderNumber: "ZM-48213", buyerUserId: "buyer1", groups, sellerName: "Glow by Zainab" };
const orderGroup = {
  orderGroupId: "og1", orderNumber: "ZM-48213", checkoutId: "c1", storeId: "s1", sellerName: "Glow by Zainab", buyerName: "Amaka O.",
  buyerAccountId: "buyer1", sellerAccountId: "seller1", paymentMode: "escrow", subtotalMinor: 1700000, shippingMinor: 150000,
  totalMinor: 1850000, refundedMinor: 0, currency: "NGN", status: "pending",
  items: [{ name: "Vitamin C Glow Serum", variant: "30ml", quantity: 2, unitPrice: money(850000), imageUrl: "https://cdn.nantty.com/p/serum.jpg" }],
};
const dispute = { disputeId: "dsp1", caseNumber: "DSP-10294", orderId: "o1", orderNumber: "ZM-48213", escrowId: "e1", buyerUserId: "buyer1", sellerUserId: "seller1", amount: money(1850000), reason: "Item damaged" };
const escrow = { escrowId: "e1", orderId: "o1", orderNumber: "ZM-48213", checkoutId: "c1", storeId: "s1", buyerUserId: "buyer1", sellerUserId: "seller1", status: "released", amount: money(1850000), commission: money(92500), refunded: money(1850000), releasedToSeller: money(1757500) };
const actor = { id: "actor1", name: "Adaeze Okafor", username: "adaeze" };
const mark = { accountId: "u1", checkmark: "gold", accountName: "Amaka Stores" };
const plan = { accountId: "u1", storeName: "Amaka Stores", plan: "pro", price: money(500000), interval: "month", cardLabel: "Visa ending 4242" };
const subscriber = { accountId: "u1", subscriptionId: "s1", audience: "business", accountName: "Amaka Stores", planLabel: "Pro plan", plan: "seller_pro", interval: "month", cardLabel: "Visa ending 4242" };
const billingItems = [{ kind: "plan_base", label: "Pro plan", amountMinor: 200000 }, { kind: "checkmark", label: "Gold checkmark", amountMinor: 300000 }];
const caseAction = { accountId: "u1", caseId: "CASE-1", reason: "Counterfeit listings", policy: "Marketplace policy", policyUrl: "https://nantty.com/policy", appealUrl: "https://nantty.com/appeal" };

export interface EventFixture {
  readonly data: Record<string, unknown>;
  readonly templates: readonly string[];
  readonly inAppRecipients: readonly string[];
}

const ticket = { ticketId: "7b9e2f3a-1111-4222-8333-123456789abc", reference: "SUP-10421", accountId: "u1", subject: "Refund has not arrived", category: "payment", channel: "form" };
const copyrightRemedy = { claimId: "0192f0a1-7c3e-7000-8000-00000000c1a1", targetType: "clip", targetId: "clip-1", infringerId: "u1", workTitle: "Lagos Nights", reason: "Proof of ownership matches.", canSubmitCounterNotice: true };
export const eventFixtures: Readonly<Record<string, EventFixture>> = {
  "order.placed": { data: { ...order, payBy: "2026-10-05T10:00:00.000Z", paymentUrl: "https://nantty.com/pay/o1" }, templates: ["orderPlaced"], inAppRecipients: ["buyer1"] },
  "orderGroup.created": { data: { ...orderGroup, payBy: "2026-10-05T10:00:00.000Z" }, templates: ["orderPlaced"], inAppRecipients: ["buyer1"] },
  "orderGroup.paid": { data: { ...orderGroup, paidAt: "2026-10-03T10:00:00.000Z", paymentMethod: "Visa •••• 4242" }, templates: ["paymentConfirmed", "sellerNewOrder"], inAppRecipients: ["buyer1", "seller1"] },
  "orderGroup.shipped": { data: { ...orderGroup, occurredAt: "2026-10-06T10:00:00.000Z", courierName: "GIG", trackingNumber: "GIG123", trackingUrl: "https://track.example/GIG123", estimatedDeliveryAt: "2026-10-07T10:00:00.000Z" }, templates: ["orderShipped"], inAppRecipients: ["buyer1"] },
  "orderGroup.delivered": { data: { ...orderGroup, occurredAt: "2026-10-08T10:00:00.000Z", deliveredAt: "2026-10-08T10:00:00.000Z", confirmBy: "2026-10-11T10:00:00.000Z" }, templates: ["orderDelivered"], inAppRecipients: ["buyer1"] },
  "orderGroup.completed": { data: { ...orderGroup, orderedAt: "2026-10-03T10:00:00.000Z", completedAt: "2026-10-11T10:00:00.000Z", attributedItems: [] }, templates: ["orderCompleted"], inAppRecipients: ["buyer1"] },
  "orderGroup.statusChanged": { data: { ...orderGroup, reference: orderGroup.orderNumber, from: "new", to: "processing", actorKind: "seller" }, templates: [], inAppRecipients: ["buyer1"] },
  "order.paid": { data: { ...order, buyerName: "Bisola", paymentMethod: "Card", paidAt: "2026-10-03T10:00:00.000Z", acceptBy: "2026-10-04T10:00:00.000Z", paymentMode: "escrow" }, templates: ["paymentConfirmed", "sellerNewOrder"], inAppRecipients: ["buyer1", "seller1"] },
  "order.sellerAccepted": { data: { ...order, shipBy: "2026-10-06T10:00:00.000Z" }, templates: ["sellerAccepted"], inAppRecipients: ["buyer1"] },
  "order.sellerRejected": { data: { ...order, reason: "Out of stock", refund: money(1850000) }, templates: ["sellerRejected"], inAppRecipients: ["buyer1"] },
  "order.shipped": { data: { ...order, carrier: "GIG", trackingNumber: "GIG123", trackingUrl: "https://track.example/GIG123", estimatedDelivery: "2026-10-07T10:00:00.000Z" }, templates: ["orderShipped"], inAppRecipients: ["buyer1"] },
  "order.delivered": { data: { ...order, confirmBy: "2026-10-10T10:00:00.000Z" }, templates: ["orderDelivered"], inAppRecipients: ["buyer1"] },
  "order.completed": { data: order, templates: ["orderCompleted"], inAppRecipients: ["buyer1"] },
  "order.cancelled": { data: { ...order, cancelledBy: "buyer", reason: "Changed my mind" }, templates: ["orderCancelled", "sellerOrderCancelled"], inAppRecipients: ["buyer1", "seller1"] },
  "escrow.held": { data: { ...escrow, groups, releaseRule: "Funds release 3 days after delivery." }, templates: ["escrowFundsProtected"], inAppRecipients: ["buyer1"] },
  "escrow.released": { data: escrow, templates: ["escrowReleased"], inAppRecipients: ["seller1"] },
  "escrow.refunded": { data: { ...escrow, status: "refunded", refundDestination: "paymentMethod" }, templates: ["refundIssued"], inAppRecipients: ["buyer1"] },
  "escrow.partiallyRefunded": { data: { ...escrow, status: "partiallyRefunded", refundDestination: "wallet" }, templates: ["refundIssued"], inAppRecipients: ["buyer1"] },
  "escrow.underReview": { data: { ...escrow, status: "held" }, templates: [], inAppRecipients: ["buyer1", "seller1"] },
  "escrow.clawedBack": { data: { ...escrow, status: "clawedBack", refunded: money(1757500), refundBreakdown: { refundedToBuyer: money(1757500), escrowFeeKept: money(92500), processingFeeKept: money(0) } }, templates: ["refundIssued"], inAppRecipients: ["buyer1"] },
  "escrow.refundScheduled": { data: { ...escrow, status: "held", pendingRefund: { id: "pr1", ...money(475000), full: false }, reason: "One item damaged" }, templates: [], inAppRecipients: ["buyer1", "seller1"] },
  "dispute.opened": { data: { ...dispute, respondBy: "2026-10-05T10:00:00.000Z", openedBy: "the buyer" }, templates: ["disputeOpened", "disputeOpened"], inAppRecipients: ["buyer1", "seller1"] },
  "disputeMessage.posted": { data: { ...dispute, authorUserId: "buyer1", message: "Photos attached.", stage: 2 }, templates: ["disputeUpdate"], inAppRecipients: ["seller1"] },
  "dispute.resolved": { data: { ...dispute, outcome: "refund_partial", buyerRefund: money(900000), sellerPayout: money(950000), summary: "Partial refund agreed." }, templates: ["disputeResolved", "disputeResolved"], inAppRecipients: ["buyer1", "seller1"] },
  "dispute.sellerResponseOverdue": { data: { ...dispute, status: "under_review", respondByAt: "2026-10-05T10:00:00.000Z" }, templates: [], inAppRecipients: ["buyer1", "seller1"] },
  "payment.failed": { data: { paymentId: "p1", reference: "R1", purpose: "order_checkout", subjectId: "o1", ownerUserId: "buyer1", provider: "flutterwave", status: "failed", amount: money(1850000) }, templates: ["paymentFailed"], inAppRecipients: ["buyer1"] },
  "payment.succeeded": { data: { paymentId: "p2", reference: "R2", purpose: "wallet_top_up", subjectId: "w1", ownerUserId: "buyer1", provider: "flutterwave", status: "succeeded", amount: money(500000) }, templates: [], inAppRecipients: ["buyer1"] },
  "payment.duplicateRefunded": { data: { paymentId: "p3", reference: "R3-late-abc", purpose: "order_checkout", subjectId: "c1", ownerUserId: "buyer1", provider: "flutterwave", status: "succeeded", amount: money(300000) }, templates: [], inAppRecipients: ["buyer1"] },
  "coinPurchase.completed": { data: { coinPurchaseId: "cp1", userId: "buyer1", packageId: "pack_500", coins: 500, source: "web", amount: money(500000), receiptNumber: "RCPT-1", balanceAfter: 700 }, templates: ["coinPurchaseReceipt"], inAppRecipients: ["buyer1"] },
  "payout.completed": { data: { withdrawalId: "w1", userId: "seller1", status: "paid", reference: "BANKREF1", amount: money(1757500), fee: money(5000) }, templates: ["payoutSent"], inAppRecipients: ["seller1"] },
  "payout.failed": { data: { withdrawalId: "w2", userId: "seller1", status: "failed", reference: "BANKREF2", amount: money(1757500), fee: money(5000) }, templates: ["payoutFailed"], inAppRecipients: ["seller1"] },
  "withdrawal.requested": { data: { withdrawalId: "w3", userId: "seller1" }, templates: [], inAppRecipients: ["seller1"] },
  "withdrawal.approved": { data: { withdrawalId: "w3", userId: "seller1" }, templates: [], inAppRecipients: ["seller1"] },
  "withdrawal.failed": { data: { withdrawalId: "w3", userId: "seller1" }, templates: [], inAppRecipients: ["seller1"] },
  "withdrawal.cancelled": { data: { withdrawalId: "w3", userId: "seller1" }, templates: [], inAppRecipients: ["seller1"] },
  "account.registered": { data: { accountId: "u1", username: "amaka", name: "Amaka", email: "amaka@example.com", method: "password" }, templates: ["welcome"], inAppRecipients: ["u1"] },
  "otp.issued": { data: { destination: "new@example.com", codeSealed: sealedOtp("482913"), keyId: "otp-1", expiresAt: "2999-01-01T00:00:00.000Z", purpose: "signup", expiresInMinutes: 5 }, templates: ["emailOtp"], inAppRecipients: [] },
  "account.passwordChanged": { data: { accountId: "u1", sessionsRevoked: 2, method: "reset", device: "Pixel 8" }, templates: ["passwordChanged"], inAppRecipients: ["u1"] },
  "session.revoked": { data: { accountId: "u1", sessionId: "s1", reason: "revoke_all", sessionCount: 3 }, templates: ["sessionsRevoked"], inAppRecipients: ["u1"] },
  "session.refreshTokenReuseDetected": { data: { accountId: "u1", sessionId: "s1" }, templates: ["sessionsRevoked"], inAppRecipients: ["u1"] },
  "signIn.newDeviceDetected": { data: { accountId: "u1", device: "iPhone 15", location: "Lagos, NG", ipAddress: "102.89.0.1" }, templates: ["newSignIn"], inAppRecipients: ["u1"] },
  "twoFactor.enabled": { data: { accountId: "u1", method: "Authenticator app" }, templates: ["twoFactorEnabled"], inAppRecipients: ["u1"] },
  "account.warned": { data: caseAction, templates: [], inAppRecipients: ["u1"] },
  "account.restricted": { data: { ...caseAction, restrictions: ["Cannot post"], until: "2026-10-20T00:00:00.000Z" }, templates: ["accountRestricted"], inAppRecipients: ["u1"] },
  "account.suspended": { data: { ...caseAction, appealBy: "2026-10-20T00:00:00.000Z", deletionAt: "2026-11-20T00:00:00.000Z" }, templates: ["accountSuspended"], inAppRecipients: ["u1"] },
  "account.banned": { data: caseAction, templates: ["accountBanned"], inAppRecipients: ["u1"] },
  "appeal.decided": { data: { accountId: "u1", caseId: "CASE-1", outcome: "overturned", explanation: "We reviewed again." }, templates: ["appealDecision"], inAppRecipients: ["u1"] },
  "report.closed": { data: { reporterUserId: "u1", reportId: "R-9", reportedWhat: "a comment", outcome: "action_taken", reportedAt: "2026-10-01T00:00:00.000Z" }, templates: ["reportOutcome"], inAppRecipients: ["u1"] },
  "dataExport.completed": { data: { accountId: "u1", exportId: "x1", completedAt: "2026-10-03T09:00:00.000Z", expiresAt: "2026-10-10T09:00:00.000Z", sizeBytes: 193000000 }, templates: ["dataExportReady"], inAppRecipients: ["u1"] },
  "account.anniversaryReached": { data: { accountId: "u1", years: 2, localDate: "2026-10-04", timezone: "Africa/Lagos", joinedAt: "2024-10-04T09:00:00.000Z", stats: { posts: 148, followers: 1260, orders: 37, lives: 9 } }, templates: ["nanttyversary"], inAppRecipients: ["u1"] },
  "account.deletionRequested": { data: { accountId: "u1", requestedAt: "2026-10-03T09:00:00.000Z", scheduledFor: "2026-10-17T09:00:00.000Z", retentionPolicy: [] }, templates: ["accountDeletionScheduled"], inAppRecipients: ["u1"] },
  "account.deletionExecuted": { data: { accountId: "u1", executedAt: "2026-10-17T09:00:00.000Z", finalEmail: "amaka@example.com", retentionPolicy: [], appliedSteps: [] }, templates: ["accountDeletionCompleted"], inAppRecipients: [] },
  "mention.created": { data: { recipientUserId: "u1", actor, surface: "comment", excerpt: "@amaka check this", url: "https://nantty.com/p/1" }, templates: ["mentionedYou"], inAppRecipients: ["u1"] },
  "post.tagged": { data: { recipientUserId: "u1", actor, postId: "p1", kind: "clip", url: "/clips/p1" }, templates: [], inAppRecipients: ["u1"] },
  "post.reshared": { data: { postId: "p2", originalPostId: "p1", authorId: "u2", originalAuthorId: "u1", isQuote: true, actor, surface: "post", url: "/post/p2" }, templates: [], inAppRecipients: ["u1"] },
  "follow.created": { data: { recipientUserId: "u1", actor }, templates: [], inAppRecipients: ["u1"] },
  "followRequest.created": { data: { recipientUserId: "u1", actor }, templates: [], inAppRecipients: ["u1"] },
  "followRequest.accepted": { data: { recipientUserId: "u2", actor, url: "/user/u1" }, templates: [], inAppRecipients: ["u2"] },
  "comment.created": { data: { recipientUserId: "u1", actor, target: "post", excerpt: "Love it" }, templates: [], inAppRecipients: ["u1"] },
  "videoReply.created": { data: { recipientUserId: "u1", actor }, templates: [], inAppRecipients: ["u1"] },
  "messageRequest.received": { data: { recipientUserId: "u1", actor }, templates: [], inAppRecipients: ["u1"] },
  "gift.sent": { data: { liveId: "l1", giftTransactionId: "g1", receiverUserId: "u1", quantity: 3, totalCoins: 90, sender: actor }, templates: [], inAppRecipients: ["u1"] },
  "creatorSubscription.started": { data: { subscriptionId: "s1", creatorId: "u1", subscriberId: "u2", kind: "initial", creatorShare: money(160000) }, templates: [], inAppRecipients: ["u1"] },
  "adInvite.created": { data: { inviteId: "i1", accountId: "acc1", accountName: "Ada's Closet", role: "advertiser", invitedBy: "Adaeze", invitedByUserId: "u2", inviteeUserId: "u1", expiresAt: "2026-10-12T09:00:00.000Z", inviteUrl: "https://ads.nantty.com/invites/i1" }, templates: ["adAccountInvite"], inAppRecipients: ["u1"] },
  "tip.sent": { data: { tipId: "t1", senderUserId: "u2", creatorUserId: "u1", targetType: "post", targetId: "p1", coins: 50, creatorCoins: 35 }, templates: [], inAppRecipients: ["u1"] },
  "affiliateCommission.credited": { data: { commissionId: "a1", creatorId: "u1", orderId: "o1", productId: "p1", storeId: "s1", commission: money(25000) }, templates: [], inAppRecipients: ["u1"] },
  "review.created": { data: { reviewId: "r1", storeId: "s1", rating: 5, authorAccountId: "u2", storeOwnerAccountId: "u1", storeName: "Ada Fabrics" }, templates: [], inAppRecipients: ["u1"] },
  "review.replied": { data: { reviewId: "r1", storeId: "s1", productId: "p1", authorAccountId: "u2", storeName: "Ada Fabrics", firstReply: true }, templates: [], inAppRecipients: ["u2"] },
  "sellerApplication.reviewed": { data: { applicationId: "a1", accountId: "u1", decision: "approved", storeName: "Ada Fabrics" }, templates: [], inAppRecipients: ["u1"] },
  "creator.standingChanged": { data: { userId: "u1", status: "suspended", reason: "Fake engagement" }, templates: [], inAppRecipients: ["u1"] },
  "message.sent": { data: { conversationId: "c1", messageId: "m1", senderId: "u2", conversationKind: "direct", senderName: "Ada", pushRecipients: [{ userId: "u1", showPreview: true }] }, templates: [], inAppRecipients: [] },
  "live.started": { data: { liveId: "l1", hostId: "h1", title: "Friday drop", category: "fashion", hostName: "Adaeze", hostHandle: "adaeze", notifyUserIds: ["u1", "u2"], emailUserIds: ["u2"] }, templates: ["liveStarted"], inAppRecipients: ["u1", "u2"] },
  "live.reminderDue": { data: { liveId: "l2", hostId: "h1", title: "Sunday pottery", scheduledAt: "2026-10-12T18:00:00.000Z", host: { id: "h1", name: "Adaeze", username: "adaeze" }, hostName: "Adaeze", hostHandle: "adaeze", notifyUserIds: ["u1", "u2"], notifyTruncated: false }, templates: [], inAppRecipients: ["u1", "u2"] },
  "checkmark.suggested": { data: { ...mark, price: money(300000), reasons: ["Consistent sales"] }, templates: ["checkmarkSuggestion"], inAppRecipients: ["u1"] },
  "checkmark.applicationSubmitted": { data: { ...mark, applicationId: "A1" }, templates: ["checkmarkApplicationReceived"], inAppRecipients: ["u1"] },
  "ticket.created": { data: { ...ticket, priority: "high", firstResponseHours: 4 }, templates: ["supportTicketReceived"], inAppRecipients: ["u1"] },
  "ticket.replied": { data: { ...ticket, authorKind: "agent", agentName: "Ngozi", message: "The refund left us today.", repliedAt: "2026-10-04T10:00:00.000Z", status: "awaiting_user" }, templates: ["supportAgentReplied"], inAppRecipients: ["u1"] },
  "ticket.resolved": { data: { ...ticket, resolution: "Refunds take up to 10 business days.", reopenDays: 7, resolvedAt: "2026-10-04T11:00:00.000Z" }, templates: ["supportTicketResolved"], inAppRecipients: ["u1"] },
  "checkmark.approved": { data: { ...mark, renewsAt: "2026-11-03T00:00:00.000Z" }, templates: ["checkmarkApproved"], inAppRecipients: ["u1"] },
  "checkmark.rejected": { data: { ...mark, reasons: ["Documents unclear"], reapplyFrom: "2026-11-03T00:00:00.000Z" }, templates: ["checkmarkRejected"], inAppRecipients: ["u1"] },
  "checkmark.revoked": { data: { ...mark, reason: "Impersonation", appealUrl: "https://nantty.com/appeal" }, templates: ["checkmarkRevoked"], inAppRecipients: ["u1"] },
  "checkmark.renewalFailed": { data: { ...mark, price: money(300000), failedAt: "2026-10-03T00:00:00.000Z", graceEndsAt: "2026-10-17T00:00:00.000Z" }, templates: ["checkmarkRenewalDue"], inAppRecipients: ["u1"] },
  "creatorApplication.submitted": { data: { accountId: "u1", applicationId: "CA1" }, templates: ["creatorApplicationReceived"], inAppRecipients: ["u1"] },
  "creatorApplication.approved": { data: { accountId: "u1", handle: "amaka" }, templates: ["creatorApproved"], inAppRecipients: ["u1"] },
  "creatorApplication.needsReview": { data: { accountId: "u1", applicationId: "CA1" }, templates: ["creatorNeedsReview"], inAppRecipients: ["u1"] },
  "creatorApplication.ineligible": { data: { accountId: "u1", requirements: [{ label: "Followers", value: 400, target: 1000 }] }, templates: ["creatorNotEligibleYet"], inAppRecipients: ["u1"] },
  "sellerDocuments.submitted": { data: { accountId: "u1", storeName: "Amaka Stores", documents: ["CAC certificate"] }, templates: ["documentsReceived"], inAppRecipients: ["u1"] },
  "sellerDocuments.approved": { data: { accountId: "u1", storeName: "Amaka Stores", documents: ["CAC certificate"] }, templates: ["documentsApproved"], inAppRecipients: ["u1"] },
  "sellerDocuments.rejected": { data: { accountId: "u1", storeName: "Amaka Stores", documents: ["CAC certificate"], issues: ["Blurry scan"] }, templates: ["documentsRejected"], inAppRecipients: ["u1"] },
  "planTrial.started": { data: { ...plan, trialEndsAt: "2026-10-10T00:00:00.000Z", verificationCharge: money(10000) }, templates: ["planTrialStarted"], inAppRecipients: ["u1"] },
  "planTrial.ending": { data: { ...plan, daysLeft: 3, trialEndsAt: "2026-10-10T00:00:00.000Z" }, templates: ["planTrialEnding"], inAppRecipients: ["u1"] },
  "planTrial.converted": { data: { ...plan, nextBillingAt: "2026-11-10T00:00:00.000Z", invoiceNumber: "INV-1" }, templates: ["planTrialConverted"], inAppRecipients: ["u1"] },
  "planInvoice.paymentFailed": { data: { ...plan, reason: "Card declined", retryAt: "2026-10-05T00:00:00.000Z", downgradeAt: "2026-10-12T00:00:00.000Z" }, templates: ["planPaymentFailed"], inAppRecipients: ["u1"] },
  "planInvoice.paid": { data: { ...plan, invoiceNumber: "INV-2", paidAt: "2026-10-03T00:00:00.000Z", periodStart: "2026-10-03T00:00:00.000Z", periodEnd: "2026-11-03T00:00:00.000Z", vat: money(37500) }, templates: ["planReceipt"], inAppRecipients: ["u1"] },
  "verification.eligible": { data: { accountId: "u1", checkmark: "blue", accountName: "@amaka.styles", deepLink: "https://nantty.com/settings/verification?step=pay" }, templates: ["verificationEligible"], inAppRecipients: ["u1"] },
  "verification.underReview": { data: { accountId: "u1", checkmark: "gold", accountName: "Adire Studio", caseId: "c1", reviewWithinDays: 3 }, templates: ["verificationUnderReview"], inAppRecipients: ["u1"] },
  "verification.approved": { data: { accountId: "u1", checkmark: "blue", accountName: "@amaka.styles", caseId: "c1", verifiedAt: "2026-10-04T10:00:00.000Z" }, templates: ["verificationApproved"], inAppRecipients: ["u1"] },
  "verification.rejectedRefunded": { data: { accountId: "u1", checkmark: "blue", accountName: "@tobi", caseId: "c1", reasons: ["Name does not match"], refundMethod: "apple_request", reapplyFrom: "2026-11-03T00:00:00.000Z" }, templates: ["verificationRejectedRefunded"], inAppRecipients: ["u1"] },
  "subscriptionTrial.ending": { data: { ...subscriber, daysLeft: 1, trialEndsAt: "2026-10-11T09:00:00.000Z", chargeAt: "2026-10-11T09:00:00.000Z", amount: money(500000), lineItems: billingItems }, templates: ["subscriptionTrialEnding"], inAppRecipients: ["u1"] },
  "subscriptionRenewal.upcoming": { data: { ...subscriber, interval: "year", chargeAt: "2027-10-04T09:00:00.000Z", amount: money(4800000), lineItems: billingItems }, templates: ["subscriptionRenewalUpcoming"], inAppRecipients: ["u1"] },
  "subscriptionInvoice.paid": { data: { ...subscriber, kind: "renewal", invoiceNumber: "INV-3", paidAt: "2026-11-11T09:00:00.000Z", periodStart: "2026-11-11T09:00:00.000Z", periodEnd: "2026-12-11T09:00:00.000Z", total: money(500000), lineItems: billingItems }, templates: ["subscriptionRenewalReceipt"], inAppRecipients: ["u1"] },
  "subscriptionPayment.failed": { data: { ...subscriber, attempt: 2, reason: "Insufficient funds", amount: money(500000), retryAt: "2026-11-14T09:00:00.000Z", downgradeAt: "2026-11-23T09:00:00.000Z", trialConversion: false }, templates: ["subscriptionPaymentFailed"], inAppRecipients: ["u1"] },
  "subscriptionGrace.ending": { data: { ...subscriber, graceEndsAt: "2026-11-23T09:00:00.000Z", amount: money(500000) }, templates: ["subscriptionGraceEnding"], inAppRecipients: ["u1"] },
  "subscription.downgraded": { data: { ...subscriber, reason: "payment_failed", checkmarkRemoved: true }, templates: ["subscriptionDowngraded"], inAppRecipients: ["u1"] },
  "subscriptionCard.expiring": { data: { ...subscriber, expiryMonth: 11, expiryYear: 2026, chargeAt: "2026-12-04T09:00:00.000Z" }, templates: ["subscriptionCardExpiring"], inAppRecipients: ["u1"] },
  "subscriptionOffer.sent": { data: { sendId: "send1", linkId: "link1", recipientEmail: "Ada@Example.com", note: "Welcome to the pilot.", claimUrl: "https://nantty.com/offer/Xq3v0mZp9bT2nR8kL5wA7cD1eF4gH6jK0lM2nP4qR6s", discountKind: "percentage", percentOff: 30, plans: [{ planCode: "seller_pro", planLabel: "Pro plan" }], durationCycles: 2, expiresAt: "", singleUse: true, sentByStaffId: "staff1" }, templates: ["subscriptionOfferInvite"], inAppRecipients: [] },
  "subscriptionPrice.changeNotice": { data: { ...subscriber, oldPrice: money(500000), newPrice: money(600000), effectiveAt: "2026-12-04T09:00:00.000Z" }, templates: ["subscriptionPriceChange"], inAppRecipients: ["u1"] },
  "cardVerification.refunded": { data: { accountId: "u1", amount: money(10000), cardLabel: "Visa ending 4242", reference: "REF-1" }, templates: ["cardVerificationRefunded"], inAppRecipients: ["u1"] },
  "copyrightClaim.warningIssued": { data: { ...copyrightRemedy, deadlineAt: "2026-10-05T11:59:00.000Z", warningId: "0192f0a1-7c3e-7000-8000-00000000c1a2" }, templates: ["copyrightWarning"], inAppRecipients: ["u1"] },
  "copyrightClaim.audioMuteOrdered": { data: copyrightRemedy, templates: ["audioMuted"], inAppRecipients: ["u1"] },
  "copyrightClaim.contentTakenDown": { data: { ...copyrightRemedy, strikeId: "0192f0a1-7c3e-7000-8000-00000000c1a3" }, templates: ["contentTakenDown"], inAppRecipients: ["u1"] },
  "copyrightClaim.counterNoticeReceived": { data: { claimId: copyrightRemedy.claimId, noticeId: "n1", infringerId: "u1", restoreEligibleAt: "2026-10-18T09:00:00.000Z", claimantUserId: "c1", claimantEmail: "owner@label.com", workTitle: "Lagos Nights" }, templates: ["counterNoticeReceived"], inAppRecipients: ["c1"] },
  "copyrightClaim.restored": { data: { ...copyrightRemedy, remedy: "audio_muted" }, templates: ["contentRestored"], inAppRecipients: ["u1"] },
  "strike.issued": { data: { strikeId: "s1", accountId: "u1", kind: "strike", policy: "Copyright infringement", source: "copyright", expiresAt: "2027-01-02T00:00:00.000Z", activeStrikeCount: 1, isRepeatInfringer: false }, templates: ["strikeIssued"], inAppRecipients: ["u1"] },
  "strike.expired": { data: { strikeId: "s1", accountId: "u1", kind: "strike", policy: "Copyright infringement", source: "copyright", expiredAt: "2027-01-02T00:00:00.000Z", activeStrikeCount: 0 }, templates: ["strikeExpired"], inAppRecipients: ["u1"] },
};
