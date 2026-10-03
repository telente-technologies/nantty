import { doesRoleHavePermission } from "@/config/rolePermissions.config";
import { buildFinanceFeeBreakdown, isIsoWithinDateKeys, listEscrowEntries, listRefundEntries, listSettlements } from "@/mocks/handlers/financeLedger.mock";
import { buildStatementDetailForMonth, listStatementMonthSummaries } from "@/mocks/handlers/financeStatements.mock";
import { convertIsoToStoreDateKey } from "@/mocks/handlers/reportSalesRecords.mock";
import { appendMockAuditLogEntry, readMockDatabase, readStoreScopedMockSlice } from "@/mocks/mockDatabase.mock";
import { matchesSearchText, MockHttpError, paginateMockList, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { EscrowEntry, FinanceSummary, PayoutSchedule, PayoutScheduleMode } from "@/types/finance.type";
import type { EscrowStatus } from "@/types/order.type";

const escrowStatuses: EscrowStatus[] = ["held", "released", "refunded", "disputed"];
const payoutScheduleModes: PayoutScheduleMode[] = ["manual", "daily", "weekly", "monthly"];

function readDateKeyRange(request: MockRequest, defaultDays: number): { fromKey: string; toKey: string } {
  const timezone = readMockDatabase().settings.timezone;
  const toKey = request.query.get("to") ?? convertIsoToStoreDateKey(new Date().toISOString(), timezone);
  const fromKey = request.query.get("from") ?? convertIsoToStoreDateKey(new Date(Date.now() - (defaultDays - 1) * 86_400_000).toISOString(), timezone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromKey) || !/^\d{4}-\d{2}-\d{2}$/.test(toKey) || fromKey > toKey) throw new MockHttpError(400, "INVALID_DATE_RANGE", "Pick a valid date range.");
  return { fromKey, toKey };
}

function calculateNextPayoutRunAt(schedule: Omit<PayoutSchedule, "nextRunAt">): string | null {
  if (schedule.mode === "manual") return null;
  const next = new Date();
  next.setUTCHours(9, 0, 0, 0);
  if (schedule.mode === "daily") next.setUTCDate(next.getUTCDate() + 1);
  if (schedule.mode === "weekly") next.setUTCDate(next.getUTCDate() + (((schedule.weekday - next.getUTCDay() + 7) % 7) || 7));
  if (schedule.mode === "monthly") {
    next.setUTCMonth(next.getUTCMonth() + (next.getUTCDate() >= schedule.dayOfMonth ? 1 : 0));
    next.setUTCDate(schedule.dayOfMonth);
  }
  return next.toISOString();
}

function readPayoutScheduleState(): { schedule: PayoutSchedule } {
  return readStoreScopedMockSlice("payoutSchedule", () => {
    const database = readMockDatabase();
    const base = { mode: "manual" as const, weekday: 1, dayOfMonth: 1, keepMinimumBalance: { amountMinor: 0, currency: database.settings.currency }, accountId: database.wallet.payoutAccounts.find((account) => account.isDefault)?.id ?? null };
    return { schedule: { ...base, nextRunAt: null } };
  });
}

function registerFinanceOverviewRoutes(): void {
  registerMockRoute("GET", "/seller/finance/summary", (request) => {
    requireMockStorePrincipal(request);
    const { fromKey, toKey } = readDateKeyRange(request, 30);
    const database = readMockDatabase();
    const currency = database.settings.currency;
    const fees = buildFinanceFeeBreakdown(fromKey, toKey);
    const refunds = listRefundEntries().filter((refund) => isIsoWithinDateKeys(refund.createdAt, fromKey, toKey));
    const refundsMinor = refunds.reduce((sum, refund) => sum + refund.amount.amountMinor, 0);
    const paidOutMinor = database.wallet.payouts.filter((payout) => payout.status !== "failed" && isIsoWithinDateKeys(payout.requestedAt, fromKey, toKey)).reduce((sum, payout) => sum + payout.amount.amountMinor, 0);
    const summary: FinanceSummary = {
      from: fromKey,
      to: toKey,
      balances: database.wallet.balances,
      grossSales: fees.grossSales,
      totalFees: fees.totalFees,
      refunds: { amountMinor: refundsMinor, currency },
      netEarnings: fees.netEarnings,
      paidOut: { amountMinor: paidOutMinor, currency },
      ordersCount: database.onlineOrders.filter((order) => order.escrowStatus !== "refunded" && isIsoWithinDateKeys(order.createdAt, fromKey, toKey)).length,
      upcomingReleases: listEscrowEntries().filter((entry) => entry.status === "held" && entry.releaseExpectedAt).sort((first, second) => (first.releaseExpectedAt ?? "").localeCompare(second.releaseExpectedAt ?? "")).slice(0, 5),
    };
    return respondWithJson(200, summary);
  });

  registerMockRoute("GET", "/seller/finance/escrow", (request) => {
    requireMockStorePrincipal(request);
    const status = request.query.get("status");
    if (status && !escrowStatuses.includes(status as EscrowStatus)) return respondWithValidationFailure([{ path: "status", message: "Choose held, released, refunded or disputed." }]);
    const everyEntry = listEscrowEntries();
    const currency = readMockDatabase().settings.currency;
    const countsByStatus = Object.fromEntries(escrowStatuses.map((candidate) => [candidate, everyEntry.filter((entry) => entry.status === candidate).length])) as Record<EscrowStatus, number>;
    const totalsByStatus = Object.fromEntries(escrowStatuses.map((candidate) => [candidate, { amountMinor: everyEntry.filter((entry) => entry.status === candidate).reduce((sum, entry) => sum + entry.net.amountMinor, 0), currency }])) as Record<EscrowStatus, { amountMinor: number; currency: typeof currency }>;
    const filtered = everyEntry.filter((entry: EscrowEntry) => (!status || entry.status === status) && matchesSearchText(request.query.get("q"), entry.orderNumber, entry.buyerName, entry.buyerUsername));
    return respondWithJson(200, { ...paginateMockList(filtered, request.query, 50), countsByStatus, totalsByStatus });
  });

  registerMockRoute("GET", "/seller/finance/settlements", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, paginateMockList(listSettlements(), request.query, 50));
  });

  registerMockRoute("GET", "/seller/finance/settlements/:settlementId", (request) => {
    requireMockStorePrincipal(request);
    const settlement = listSettlements().find((candidate) => candidate.id === request.params.settlementId);
    if (!settlement) throw new MockHttpError(404, "SETTLEMENT_NOT_FOUND", "That settlement does not exist.");
    return respondWithJson(200, { settlement, orders: listEscrowEntries().filter((entry) => entry.settlementId === settlement.id) });
  });

  registerMockRoute("GET", "/seller/finance/fees", (request) => {
    requireMockStorePrincipal(request);
    const { fromKey, toKey } = readDateKeyRange(request, 30);
    return respondWithJson(200, buildFinanceFeeBreakdown(fromKey, toKey));
  });

  registerMockRoute("GET", "/seller/finance/refunds", (request) => {
    requireMockStorePrincipal(request);
    const { fromKey, toKey } = readDateKeyRange(request, 90);
    const refunds = listRefundEntries().filter((refund) => isIsoWithinDateKeys(refund.createdAt, fromKey, toKey) && matchesSearchText(request.query.get("q"), refund.orderNumber, refund.buyerName));
    return respondWithJson(200, paginateMockList(refunds, request.query, 50));
  });

  registerMockRoute("GET", "/seller/finance/statements", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, { data: listStatementMonthSummaries(), nextCursor: null });
  });

  registerMockRoute("GET", "/seller/finance/statements/:month", (request) => {
    requireMockStorePrincipal(request);
    const month = request.params.month ?? "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return respondWithValidationFailure([{ path: "month", message: "Choose a month in the format YYYY-MM." }]);
    return respondWithJson(200, buildStatementDetailForMonth(month));
  });
}

function registerPayoutScheduleRoutes(): void {
  registerMockRoute("GET", "/seller/wallet/payouts/schedule", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, readPayoutScheduleState().schedule);
  });

  registerMockRoute("PUT", "/seller/wallet/payouts/schedule", (request) => {
    const principal = requireMockStorePrincipal(request);
    if (!doesRoleHavePermission(principal.role, "wallet:withdraw")) throw new MockHttpError(403, "FORBIDDEN", "Only the store owner can change automatic payouts.");
    const body = readJsonObjectBody(request);
    const database = readMockDatabase();
    const issues: { path: string; message: string }[] = [];
    const mode = body.mode as PayoutScheduleMode;
    const weekday = Number(body.weekday ?? 1);
    const dayOfMonth = Number(body.dayOfMonth ?? 1);
    const keepMinimumMinor = Number(body.keepMinimumBalanceMinor ?? 0);
    const accountId = typeof body.accountId === "string" ? body.accountId : null;
    if (!payoutScheduleModes.includes(mode)) issues.push({ path: "mode", message: "Choose manual, daily, weekly or monthly." });
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) issues.push({ path: "weekday", message: "Choose a day of the week." });
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) issues.push({ path: "dayOfMonth", message: "Choose a day between 1 and 28." });
    if (!Number.isSafeInteger(keepMinimumMinor) || keepMinimumMinor < 0) issues.push({ path: "keepMinimumBalanceMinor", message: "Enter an amount of zero or more." });
    if (mode !== "manual" && !database.wallet.payoutAccounts.some((account) => account.id === accountId)) issues.push({ path: "accountId", message: "Choose one of your payout accounts." });
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const base = { mode, weekday, dayOfMonth, keepMinimumBalance: { amountMinor: keepMinimumMinor, currency: database.settings.currency }, accountId };
    const state = readPayoutScheduleState();
    state.schedule = { ...base, nextRunAt: calculateNextPayoutRunAt(base) };
    appendMockAuditLogEntry({ actor: { id: principal.staffId ?? principal.userId, name: principal.actorName, role: principal.role ?? "owner" }, action: "payout_schedule.updated", targetType: "payout_schedule", targetId: null, summary: mode === "manual" ? "Turned off automatic payouts" : `Set automatic payouts to ${mode}` });
    return respondWithJson(200, state.schedule);
  });
}

export function registerFinanceAndReportsMockHandlers(): void {
  registerFinanceOverviewRoutes();
  registerPayoutScheduleRoutes();
}
