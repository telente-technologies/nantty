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
  items: [{ name: "Vitamin C Glow Serum", quantity: 2, unitPrice: money(850000), imageUrl: "https://cdn.zudomart.com/p/serum.jpg" }],
}];

const order = { orderId: "o1", orderNumber: "ZM-48213", buyerUserId: "buyer1", groups, sellerName: "Glow by Zainab" };
const dispute = { disputeId: "dsp1", caseNumber: "DSP-10294", orderId: "o1", orderNumber: "ZM-48213", escrowId: "e1", buyerUserId: "buyer1", sellerUserId: "seller1", amount: money(1850000), reason: "Item damaged" };
const escrow = { escrowId: "e1", orderId: "o1", orderNumber: "ZM-48213", checkoutId: "c1", storeId: "s1", buyerUserId: "buyer1", sellerUserId: "seller1", status: "released", amount: money(1850000), commission: money(92500), refunded: money(1850000), releasedToSeller: money(1757500) };
const actor = { id: "actor1", name: "Adaeze Okafor", username: "adaeze" };
const mark = { accountId: "u1", checkmark: "gold", accountName: "Amaka Stores" };
const plan = { accountId: "u1", storeName: "Amaka Stores", plan: "pro", price: money(500000), interval: "month", cardLabel: "Visa ending 4242" };
const caseAction = { accountId: "u1", caseId: "CASE-1", reason: "Counterfeit listings", policy: "Marketplace policy", policyUrl: "https://zudomart.com/policy", appealUrl: "https://zudomart.com/appeal" };

export interface EventFixture {
  readonly data: Record<string, unknown>;
  readonly templates: readonly string[];
  readonly inAppRecipients: readonly string[];
}

export const eventFixtures: Readonly<Record<string, EventFixture>> = {
  "order.placed": { data: { ...order, payBy: "2026-10-05T10:00:00.000Z", paymentUrl: "https://zudomart.com/pay/o1" }, templates: ["orderPlaced"], inAppRecipients: ["buyer1"] },
  "order.paid": { data: { ...order, buyerName: "Bisola", paymentMethod: "Card", paidAt: "2026-10-03T10:00:00.000Z", acceptBy: "2026-10-04T10:00:00.000Z", paymentMode: "escrow" }, templates: ["paymentConfirmed", "sellerNewOrder"], inAppRecipients: ["buyer1", "seller1"] },
  "order.sellerAccepted": { data: { ...order, shipBy: "2026-10-06T10:00:00.000Z" }, templates: ["sellerAccepted"], inAppRecipients: ["buyer1"] },
  "order.sellerRejected": { data: { ...order, reason: "Out of stock", refund: money(1850000) }, templates: ["sellerRejected"], inAppRecipients: ["buyer1"] },
  "order.shipped": { data: { ...order, carrier: "GIG", trackingNumber: "GIG123", trackingUrl: "https://track.example/GIG123", estimatedDelivery: "2026-10-07T10:00:00.000Z" }, templates: ["orderShipped"], inAppRecipients: ["buyer1"] },
  "order.delivered": { data: { ...order, confirmBy: "2026-10-10T10:00:00.000Z" }, templates: ["orderDelivered"], inAppRecipients: ["buyer1"] },
  "order.completed": { data: order, templates: ["orderCompleted"], inAppRecipients: ["buyer1"] },
  "order.cancelled": { data: { ...order, cancelledBy: "buyer", reason: "Changed my mind" }, templates: ["orderCancelled", "sellerOrderCancelled"], inAppRecipients: ["buyer1", "seller1"] },
  "escrow.held": { data: { ...escrow, groups, releaseRule: "Funds release 3 days after delivery." }, templates: ["escrowFundsProtected"], inAppRecipients: ["buyer1"] },
  "escrow.released": { data: escrow, templates: ["escrowReleased"], inAppRecipients: ["seller1"] },
  "escrow.refunded": { data: escrow, templates: ["refundIssued"], inAppRecipients: ["buyer1"] },
  "escrow.partiallyRefunded": { data: escrow, templates: ["refundIssued"], inAppRecipients: ["buyer1"] },
  "dispute.opened": { data: { ...dispute, respondBy: "2026-10-05T10:00:00.000Z", openedBy: "the buyer" }, templates: ["disputeOpened", "disputeOpened"], inAppRecipients: ["buyer1", "seller1"] },
  "disputeMessage.posted": { data: { ...dispute, authorUserId: "buyer1", message: "Photos attached.", stage: 2 }, templates: ["disputeUpdate"], inAppRecipients: ["seller1"] },
  "dispute.resolved": { data: { ...dispute, outcome: "refund_partial", buyerRefund: money(900000), sellerPayout: money(950000), summary: "Partial refund agreed." }, templates: ["disputeResolved", "disputeResolved"], inAppRecipients: ["buyer1", "seller1"] },
  "payment.failed": { data: { paymentId: "p1", reference: "R1", purpose: "order_checkout", subjectId: "o1", ownerUserId: "buyer1", provider: "paystack", status: "failed", amount: money(1850000) }, templates: ["paymentFailed"], inAppRecipients: ["buyer1"] },
  "payment.succeeded": { data: { paymentId: "p2", reference: "R2", purpose: "wallet_top_up", subjectId: "w1", ownerUserId: "buyer1", provider: "paystack", status: "succeeded", amount: money(500000) }, templates: [], inAppRecipients: ["buyer1"] },
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
  "account.anniversaryReached": { data: { accountId: "u1", years: 2, localDate: "2026-10-04", timezone: "Africa/Lagos", joinedAt: "2024-10-04T09:00:00.000Z", stats: { posts: 148, followers: 1260, orders: 37, lives: 9 } }, templates: ["zudoversary"], inAppRecipients: ["u1"] },
  "account.deletionRequested": { data: { accountId: "u1", requestedAt: "2026-10-03T09:00:00.000Z", scheduledFor: "2026-10-17T09:00:00.000Z", retentionPolicy: [] }, templates: ["accountDeletionScheduled"], inAppRecipients: ["u1"] },
  "account.deletionExecuted": { data: { accountId: "u1", executedAt: "2026-10-17T09:00:00.000Z", finalEmail: "amaka@example.com", retentionPolicy: [], appliedSteps: [] }, templates: ["accountDeletionCompleted"], inAppRecipients: [] },
  "mention.created": { data: { recipientUserId: "u1", actor, surface: "comment", excerpt: "@amaka check this", url: "https://zudomart.com/p/1" }, templates: ["mentionedYou"], inAppRecipients: ["u1"] },
  "follow.created": { data: { recipientUserId: "u1", actor }, templates: [], inAppRecipients: ["u1"] },
  "followRequest.created": { data: { recipientUserId: "u1", actor }, templates: [], inAppRecipients: ["u1"] },
  "comment.created": { data: { recipientUserId: "u1", actor, target: "post", excerpt: "Love it" }, templates: [], inAppRecipients: ["u1"] },
  "videoReply.created": { data: { recipientUserId: "u1", actor }, templates: [], inAppRecipients: ["u1"] },
  "messageRequest.received": { data: { recipientUserId: "u1", actor }, templates: [], inAppRecipients: ["u1"] },
  "gift.sent": { data: { liveId: "l1", giftTransactionId: "g1", receiverUserId: "u1", quantity: 3, totalCoins: 90, sender: actor }, templates: [], inAppRecipients: ["u1"] },
  "live.started": { data: { liveId: "l1", hostId: "h1", title: "Friday drop", category: "fashion", hostName: "Adaeze", hostHandle: "adaeze", notifyUserIds: ["u1", "u2"], emailUserIds: ["u2"] }, templates: ["liveStarted"], inAppRecipients: ["u1", "u2"] },
  "checkmark.suggested": { data: { ...mark, price: money(300000), reasons: ["Consistent sales"] }, templates: ["checkmarkSuggestion"], inAppRecipients: ["u1"] },
  "checkmark.applicationSubmitted": { data: { ...mark, applicationId: "A1" }, templates: ["checkmarkApplicationReceived"], inAppRecipients: ["u1"] },
  "checkmark.approved": { data: { ...mark, renewsAt: "2026-11-03T00:00:00.000Z" }, templates: ["checkmarkApproved"], inAppRecipients: ["u1"] },
  "checkmark.rejected": { data: { ...mark, reasons: ["Documents unclear"], reapplyFrom: "2026-11-03T00:00:00.000Z" }, templates: ["checkmarkRejected"], inAppRecipients: ["u1"] },
  "checkmark.revoked": { data: { ...mark, reason: "Impersonation", appealUrl: "https://zudomart.com/appeal" }, templates: ["checkmarkRevoked"], inAppRecipients: ["u1"] },
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
  "cardVerification.refunded": { data: { accountId: "u1", amount: money(10000), cardLabel: "Visa ending 4242", reference: "REF-1" }, templates: ["cardVerificationRefunded"], inAppRecipients: ["u1"] },
};
