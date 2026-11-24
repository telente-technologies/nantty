import { readMockMoneyStore } from "@/mocks/handlers/money/moneyStore.mock";
import { calculateEscrowHeldMinor, calculateOrderTotalMinor } from "@/mocks/handlers/money/moneyStore.mock";
import { requireMockPermission, requireMockSingleUseStepUp, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, paginateByCursor, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { FinanceEscrowRecord, FinanceExportRecord, FinanceIssue, SellerReserveHold, StuckPayoutAccount } from "@/types/finance.type";

const exportAuditLog: FinanceExportRecord[] = [];

function groupAmounts(items: readonly { readonly currency: string; readonly amountMinor: number }[]) {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amountMinor);
  return [...totals].sort(([left], [right]) => left.localeCompare(right)).map(([currency, amountMinor]) => ({ currency, amountMinor }));
}

export function registerFinanceMockHandlers(): void {
  registerMockRoute("GET", "/admin/finance/overview", (request) => {
    requireMockPermission(request, "finance:reports");
    const store = readMockMoneyStore();
    const currency = request.query.get("currency") || undefined;
    const range = request.query.get("range") || "7d";
    const matchesCurrency = (code: string) => !currency || code === currency;
    const eligibleOrders = store.orders.filter((order) => order.status !== "CANCELLED");
    const gmv = groupAmounts(eligibleOrders.map((order) => ({ currency: order.currency, amountMinor: calculateOrderTotalMinor(order) })).filter((item) => matchesCurrency(item.currency)));
    const held = groupAmounts(eligibleOrders.filter((order) => !["RELEASED", "REFUNDED"].includes(order.escrowStatus)).map((order) => ({ currency: order.currency, amountMinor: calculateEscrowHeldMinor(order) })).filter((item) => matchesCurrency(item.currency)));
    const released = groupAmounts(store.orders.flatMap((order) => order.timeline.filter((event) => event.kind === "RELEASED" && event.amount).map((event) => ({ currency: event.amount!.currency, amountMinor: event.amount!.amountMinor }))).filter((item) => matchesCurrency(item.currency)));
    const refunded = groupAmounts(store.orders.map((order) => ({ currency: order.currency, amountMinor: order.refundedMinor })).filter((item) => item.amountMinor > 0 && matchesCurrency(item.currency)));
    const pendingWithdrawals = store.withdrawals.filter((withdrawal) => ["pending_review", "queued", "processing"].includes(withdrawal.withdrawalStatus));
    const pendingMinor = pendingWithdrawals.filter((item) => matchesCurrency(item.currency)).reduce((sum, item) => sum + item.amountMinor, 0);
    const coinSales = groupAmounts(store.coinTransactions.filter((coin) => coin.kind === "purchase" && coin.fiatMinor !== null).map((coin) => ({ currency: coin.currency, amountMinor: coin.fiatMinor ?? 0 })).filter((item) => matchesCurrency(item.currency)));
    return respondWithJson(200, {
      generatedAt: new Date().toISOString(),
      range,
      ...(currency ? { currency } : {}),
      gmvByCurrency: gmv,
      escrowHeldByCurrency: held,
      escrowReleasedByCurrency: released,
      escrowRefundedByCurrency: refunded,
      payoutsPendingByCurrency: groupAmounts(pendingWithdrawals.map((item) => ({ amountMinor: item.amountMinor, currency: item.currency })).filter((item) => matchesCurrency(item.currency))),
      coinSalesByCurrency: coinSales,
      adTopUpsByCurrency: [],
      subscriptionByCurrency: [],
      platformRevenueByCurrency: [],
      disputesOpenCount: store.disputes.filter((dispute) => dispute.status !== "RESOLVED").length,
      stuckEscrowsCount: store.orders.filter((order) => ["FUNDED", "HELD", "DISPUTED", "PARTIALLY_REFUNDED"].includes(order.escrowStatus) && !order.autoReleaseAt).length,
      payoutsPendingCount: pendingWithdrawals.length,
      payoutsAgedCount: pendingWithdrawals.filter((withdrawal) => withdrawal.withdrawalStatus === "processing" && Date.now() - Date.parse(withdrawal.createdAt) > 60 * 60 * 1000).length,
      sellerDebtAccountsCount: 0,
      health: [],
    });
  });

  registerMockRoute("GET", "/admin/finance/escrow-held", (request) => {
    requireMockPermission(request, "finance:reports");
    const store = readMockMoneyStore();
    const currency = request.query.get("currency");
    const rows: FinanceEscrowRecord[] = store.orders
      .filter((order) => (!currency || order.currency === currency))
      .map((order, index) => ({
        id: `esc_${order.id}`,
        orderId: order.id,
        status: order.escrowStatus.toLowerCase(),
        amount: { amountMinor: calculateOrderTotalMinor(order), currency: order.currency },
        autoReleaseAt: index === 0 ? null : order.placedAt,
        deliveredAt: order.placedAt,
        releasedAt: null,
        refundedAt: null,
        stuck: index === 0,
      }));
    return respondWithJson(200, paginateByCursor(rows, request));
  });

  registerMockRoute("GET", "/admin/finance/stuck-escrows", (request) => {
    requireMockPermission(request, "finance:reports");
    const firstOrder = readMockMoneyStore().orders[0];
    const rows: FinanceEscrowRecord[] = firstOrder
      ? [{ id: `esc_${firstOrder.id}`, orderId: firstOrder.id, status: "held", amount: { amountMinor: calculateOrderTotalMinor(firstOrder), currency: firstOrder.currency }, autoReleaseAt: null, deliveredAt: firstOrder.placedAt, releasedAt: null, refundedAt: null, stuck: true }]
      : [];
    return respondWithJson(200, paginateByCursor(rows, request));
  });

  registerMockRoute("GET", "/admin/finance/money-by-aspect", (request) => {
    requireMockPermission(request, "finance:reports");
    const aspect = request.query.get("aspect") || "all";
    const range = request.query.get("range") || "7d";
    const currency = request.query.get("currency");
    const store = readMockMoneyStore();
    const allRows = [
      ...groupAmounts(store.orders.map((order) => ({ currency: order.currency, amountMinor: calculateOrderTotalMinor(order) })).filter((row) => !currency || row.currency === currency)).map((row) => ({ group: "order_checkout", status: "recorded", count: store.orders.filter((order) => order.currency === row.currency).length, ...row })),
      ...groupAmounts(store.coinTransactions.filter((coin) => coin.kind === "purchase" && coin.fiatMinor !== null).map((coin) => ({ currency: coin.currency, amountMinor: coin.fiatMinor ?? 0 })).filter((row) => !currency || row.currency === currency)).map((row) => ({ group: "coin_purchase", status: "recorded", count: store.coinTransactions.filter((coin) => coin.kind === "purchase" && coin.currency === row.currency).length, ...row })),
    ];
    return respondWithJson(200, { aspect, range, generatedAt: new Date().toISOString(), breakdown: allRows });
  });

  registerMockRoute("GET", "/admin/finance/issues", (request) => {
    requireMockPermission(request, "finance:reports");
    const queue = request.query.get("queue");
    const firstOrder = readMockMoneyStore().orders[0];
    const issues: FinanceIssue[] = firstOrder
      ? [{ id: `escrow:esc_${firstOrder.id}`, queue: "stuck_escrows", entityType: "order", entityId: firstOrder.id, reference: firstOrder.orderNumber, summary: "Escrow held has no auto_release_at timestamp", amount: { amountMinor: calculateOrderTotalMinor(firstOrder), currency: firstOrder.currency }, severity: "high", slaHours: 48, detectedAt: firstOrder.placedAt, actionHref: `/commerce/orders/${firstOrder.id}` }]
      : [];
    return respondWithJson(200, {
      data: queue ? issues.filter((issue) => issue.queue === queue) : issues,
      nextCursor: null,
      queueCounts: { stuck_escrows: issues.length, open_disputes: 0, aged_processing_payouts: 0, pending_review_payouts: 0, failed_payments: 0, seller_debt_accounts: 0 },
    });
  });

  registerMockRoute("GET", "/admin/finance/lookup", (request) => {
    requireMockPermission(request, "finance:reports");
    const query = (request.query.get("ref") ?? "").trim();
    const order = readMockMoneyStore().orders.find((candidate) => candidate.id === query || candidate.orderNumber === query);
    if (!order) {
      return respondWithJson(200, { query, found: false, checkedStores: 5, message: "not found (checked 5 stores)", hops: [] });
    }
    return respondWithJson(200, {
      query,
      found: true,
      checkedStores: 5,
      message: "Found 1 matching record(s) across 5 checked stores",
      hops: [{ store: "orders", entityType: "order_payable", entityId: order.id, reference: order.orderNumber, status: order.status, amount: { amountMinor: calculateOrderTotalMinor(order), currency: order.currency }, occurredAt: order.placedAt, detail: `Order ${order.orderNumber}`, actionHref: `/commerce/orders/${order.id}` }],
    });
  });

  registerMockRoute("GET", "/admin/finance/reports", (request) => {
    requireMockPermission(request, "finance:reports");
    return respondWithJson(200, {
      reports: [
        { key: "overview", title: "Platform Money Overview", description: "GMV, escrow holds, payouts, coin sales, ads top-ups, and subscriptions by currency.", lastExport: exportAuditLog[0]?.occurredAt ?? null },
        { key: "escrow_held", title: "Held & Disputed Escrows", description: "Open escrow balances with release dates and delivery state.", lastExport: null },
        { key: "stuck_escrows", title: "Stuck Escrows Queue", description: "Held or partially refunded escrows missing auto_release_at.", lastExport: null },
        { key: "money_by_aspect", title: "Revenue & Flow by Aspect", description: "Payments, withdrawals, and ledger balances broken down by aspect and currency.", lastExport: null },
        { key: "issues", title: "Financial Issues Queue", description: "SLA-breaching disputes, aged processing payouts, failed intents, and seller debt.", lastExport: null },
      ],
      recent: exportAuditLog.slice(0, 20),
    });
  });

  registerMockRoute("POST", "/admin/finance/reports/export", (request) => {
    const principal = requireMockPermission(request, "finance:reports");
    requireMockSingleUseStepUp(request);
    const body = (request.jsonBody ?? {}) as { reportType?: string; reason?: string };
    if (!body.reason || body.reason.trim().length < 5) {
      throw new MockHttpError(400, "REASON_REQUIRED", "A reason of at least 5 characters is required.");
    }
    exportAuditLog.unshift({ id: `fexp_${exportAuditLog.length + 1}`, reportKey: body.reportType ?? "overview", actorId: principal.adminId, actorName: principal.name, reason: body.reason.trim(), occurredAt: new Date().toISOString() });
    return { status: 200, body: "metric,currency,amountMinor,count\ngmv,NGN,245000000,\n", headers: { "content-type": "text/csv; charset=utf-8" } };
  });

  const stuckAccounts: StuckPayoutAccount[] = [
    {
      userId: "usr_creator_104",
      account: { status: "PENDING_CREATION", verificationStatus: "DOCUMENTS_REQUIRED", provider: "STRIPE_CONNECT", updatedAt: "2026-11-14T10:15:00Z" },
      jobs: [{ id: "pjob_901", jobType: "ONBOARDING_SYNC", status: "FAILED", lastError: "Missing government ID document" }],
    },
  ];

  registerMockRoute("GET", "/admin/payments/payout-accounts/stuck", (request) => {
    requireMockPermission(request, "payments:wallets");
    return respondWithJson(200, { data: stuckAccounts, nextCursor: null });
  });

  registerMockRoute("POST", "/admin/payments/payout-accounts/jobs/:jobId/retry", (request) => {
    requireMockPermission(request, "payments:wallets");
    requireMockStepUp(request);
    readRequiredReason(readJsonObjectBody(request));
    return respondWithJson(200, { jobId: request.params.jobId, status: "QUEUED" });
  });

  registerMockRoute("POST", "/admin/payments/payout-accounts/:userId/verification-prompt", (request) => {
    requireMockPermission(request, "payments:wallets");
    requireMockStepUp(request);
    readRequiredReason(readJsonObjectBody(request));
    return respondWithJson(200, { sent: true });
  });

  const sellerReserves: SellerReserveHold[] = [
    {
      sellerUserId: "usr_seller_209",
      reserveBps: 1500,
      holdDays: 30,
      reason: "Elevated return rate on electronics orders",
      flaggedBy: "adm_finance_1",
      createdAt: "2026-11-10T09:00:00Z",
      releasedAt: null,
    },
  ];

  registerMockRoute("GET", "/admin/wallet/seller-reserves", (request) => {
    requireMockPermission(request, "payouts:approve");
    return respondWithJson(200, { data: sellerReserves.filter((row) => row.releasedAt === null), nextCursor: null });
  });

  registerMockRoute("PUT", "/admin/wallet/seller-reserves/:sellerUserId", (request) => {
    const principal = requireMockPermission(request, "payouts:approve");
    requireMockStepUp(request);
    const body = readJsonObjectBody(request) as { reason?: string; reserveBps?: number; holdDays?: number };
    const reason = readRequiredReason(body);
    const nextRow: SellerReserveHold = {
      sellerUserId: request.params.sellerUserId!,
      reserveBps: Number(body.reserveBps ?? 1000),
      holdDays: Number(body.holdDays ?? 30),
      reason,
      flaggedBy: principal.adminId,
      createdAt: new Date().toISOString(),
      releasedAt: null,
    };
    const idx = sellerReserves.findIndex((row) => row.sellerUserId === nextRow.sellerUserId);
    if (idx >= 0) sellerReserves[idx] = nextRow;
    else sellerReserves.unshift(nextRow);
    return respondWithJson(201, nextRow);
  });

  registerMockRoute("DELETE", "/admin/wallet/seller-reserves/:sellerUserId", (request) => {
    requireMockPermission(request, "payouts:approve");
    requireMockStepUp(request);
    readRequiredReason(readJsonObjectBody(request));
    const idx = sellerReserves.findIndex((row) => row.sellerUserId === request.params.sellerUserId && row.releasedAt === null);
    if (idx < 0) throw new MockHttpError(404, "NOT_FOUND", "No active reserve hold for this seller.");
    sellerReserves[idx] = { ...sellerReserves[idx]!, releasedAt: new Date().toISOString() };
    return { status: 204, body: undefined };
  });

  registerMockRoute("POST", "/admin/payments/reconciliations", (request) => {
    requireMockPermission(request, "payments:wallets");
    requireMockStepUp(request);
    readRequiredReason(readJsonObjectBody(request));
    return respondWithJson(200, {
      accountsChecked: 42,
      pendingIntentsVerified: 3,
      transfersConfirmed: 11,
      directChargesSettled: 6,
      balanceBreaks: [],
      failures: 0,
    });
  });
}
