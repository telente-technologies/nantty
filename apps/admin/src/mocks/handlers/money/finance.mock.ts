import { readMockMoneyStore } from "@/mocks/handlers/money/moneyStore.mock";
import { requireMockPermission, requireMockSingleUseStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, paginateByCursor, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { FinanceEscrowRecord, FinanceExportRecord, FinanceIssue } from "@/types/finance.type";

const exportAuditLog: FinanceExportRecord[] = [];

const totalOrderMinor = (order: ReturnType<typeof readMockMoneyStore>["orders"][number]) =>
  order.items.reduce((sum, item) => sum + item.unitPriceMinor * item.quantity, 0) + order.deliveryFeeMinor;

export function registerFinanceMockHandlers(): void {
  registerMockRoute("GET", "/admin/finance/overview", (request) => {
    requireMockPermission(request, "finance:reports");
    const store = readMockMoneyStore();
    const currency = request.query.get("currency") || undefined;
    const range = request.query.get("range") || "7d";
    const matchesCurrency = (code: string) => !currency || code === currency;
    const heldMinor = store.orders.filter((order) => order.escrowStatus === "HELD" && matchesCurrency(order.currency)).reduce((sum, order) => sum + totalOrderMinor(order), 0);
    const gmvMinor = store.orders.filter((order) => matchesCurrency(order.currency)).reduce((sum, order) => sum + totalOrderMinor(order), 0);
    const pendingWithdrawals = store.withdrawals.filter((withdrawal) => withdrawal.withdrawalStatus === "pending_review" || withdrawal.withdrawalStatus === "queued");
    const pendingMinor = pendingWithdrawals.filter((item) => matchesCurrency(item.currency)).reduce((sum, item) => sum + item.amountMinor, 0);
    const coinMinor = store.coinTransactions.filter((coin) => coin.kind === "purchase" && matchesCurrency(coin.currency)).reduce((sum, coin) => sum + (coin.fiatMinor ?? 0), 0);
    const filterList = (items: readonly { amountMinor: number; currency: string }[]) => items.filter((item) => matchesCurrency(item.currency));
    return respondWithJson(200, {
      generatedAt: new Date().toISOString(),
      range,
      ...(currency ? { currency } : {}),
      gmvByCurrency: filterList([{ amountMinor: gmvMinor, currency: currency ?? "NGN" }]),
      escrowHeldByCurrency: filterList([{ amountMinor: heldMinor, currency: currency ?? "NGN" }]),
      escrowReleasedByCurrency: filterList([{ amountMinor: 420_000_00, currency: currency ?? "NGN" }]),
      escrowRefundedByCurrency: filterList([{ amountMinor: 85_000_00, currency: currency ?? "NGN" }]),
      payoutsPendingByCurrency: filterList([{ amountMinor: pendingMinor, currency: currency ?? "NGN" }]),
      coinSalesByCurrency: filterList([{ amountMinor: coinMinor, currency: currency ?? "NGN" }]),
      adTopUpsByCurrency: filterList([{ amountMinor: 190_000_00, currency: currency ?? "NGN" }]),
      subscriptionByCurrency: filterList([{ amountMinor: 95_000_00, currency: currency ?? "NGN" }]),
      platformRevenueByCurrency: filterList([{ amountMinor: 315_000_00, currency: currency ?? "NGN" }]),
      disputesOpenCount: store.disputes.filter((dispute) => dispute.status !== "RESOLVED").length,
      stuckEscrowsCount: 1,
      payoutsPendingCount: pendingWithdrawals.length,
      payoutsAgedCount: 0,
      sellerDebtAccountsCount: 0,
      health: [
        { name: "Payments", status: "OPERATIONAL", latencyMs: 12, note: null },
        { name: "Escrow", status: "OPERATIONAL", latencyMs: 9, note: null },
        { name: "Wallet", status: "OPERATIONAL", latencyMs: 11, note: null },
        { name: "Ledger", status: "OPERATIONAL", latencyMs: 8, note: null },
      ],
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
        amount: { amountMinor: totalOrderMinor(order), currency: order.currency },
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
      ? [{ id: `esc_${firstOrder.id}`, orderId: firstOrder.id, status: "held", amount: { amountMinor: totalOrderMinor(firstOrder), currency: firstOrder.currency }, autoReleaseAt: null, deliveredAt: firstOrder.placedAt, releasedAt: null, refundedAt: null, stuck: true }]
      : [];
    return respondWithJson(200, paginateByCursor(rows, request));
  });

  registerMockRoute("GET", "/admin/finance/money-by-aspect", (request) => {
    requireMockPermission(request, "finance:reports");
    const aspect = request.query.get("aspect") || "all";
    const range = request.query.get("range") || "7d";
    const currency = request.query.get("currency");
    const allRows = [
      { group: "order_checkout", status: "succeeded", count: 48, amountMinor: 2_450_000_00, currency: "NGN" },
      { group: "coin_purchase", status: "succeeded", count: 132, amountMinor: 610_000_00, currency: "NGN" },
      { group: "ad_balance_top_up", status: "succeeded", count: 19, amountMinor: 190_000_00, currency: "NGN" },
      { group: "subscription_blue", status: "succeeded", count: 84, amountMinor: 95_000_00, currency: "NGN" },
    ].filter((row) => !currency || row.currency === currency);
    return respondWithJson(200, { aspect, range, generatedAt: new Date().toISOString(), breakdown: allRows });
  });

  registerMockRoute("GET", "/admin/finance/issues", (request) => {
    requireMockPermission(request, "finance:reports");
    const queue = request.query.get("queue");
    const firstOrder = readMockMoneyStore().orders[0];
    const issues: FinanceIssue[] = firstOrder
      ? [{ id: `escrow:esc_${firstOrder.id}`, queue: "stuck_escrows", entityType: "order", entityId: firstOrder.id, reference: firstOrder.orderNumber, summary: "Escrow held has no auto_release_at timestamp", amount: { amountMinor: totalOrderMinor(firstOrder), currency: firstOrder.currency }, severity: "high", slaHours: 48, detectedAt: firstOrder.placedAt, actionHref: `/commerce/orders/${firstOrder.id}` }]
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
      hops: [{ store: "orders", entityType: "order_payable", entityId: order.id, reference: order.orderNumber, status: order.status, amount: { amountMinor: totalOrderMinor(order), currency: order.currency }, occurredAt: order.placedAt, detail: `Order ${order.orderNumber}`, actionHref: `/commerce/orders/${order.id}` }],
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
}
