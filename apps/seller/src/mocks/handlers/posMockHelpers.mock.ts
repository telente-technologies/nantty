import { doesRoleHavePermission } from "@/config/rolePermissions.config";
import { readGlobalMockSlice, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError } from "@/mocks/mockResponses.mock";
import type { MockPrincipal } from "@/mocks/mockRouter.mock";
import type { Money } from "@/types/money.type";
import type { PosShift, ShiftTotals } from "@/types/pos.type";
import type { PaymentMethod } from "@/types/store.type";
import type { DiscountApproval, PosPayLink } from "@/types/posExtra.type";

export interface PosMockSlice {
  discountApprovals: Map<string, DiscountApproval & { readonly storeId: string; consumed: boolean }>;
  payLinks: Map<string, PosPayLink & { pollCount: number; readonly clientSaleId: string }>;
}

export function readPosMockSlice(): PosMockSlice {
  return readGlobalMockSlice<PosMockSlice>("pos", () => ({ discountApprovals: new Map(), payLinks: new Map() }));
}

export function buildStoreMoney(amountMinor: number): Money {
  return { amountMinor, currency: readMockDatabase().settings.currency };
}

export function canPrincipalManageAllShifts(principal: MockPrincipal): boolean {
  return doesRoleHavePermission(principal.role, "pos:manage_all_shifts");
}

export function findShiftOrThrow(shiftId: string): PosShift {
  const shift = readMockDatabase().shifts.find((candidate) => candidate.id === shiftId);
  if (!shift) throw new MockHttpError(404, "SHIFT_NOT_FOUND", "That shift does not exist.");
  return shift;
}

export function assertPrincipalMayUseShift(principal: MockPrincipal, shift: PosShift): void {
  if (shift.openedBy.id !== principal.staffId && !canPrincipalManageAllShifts(principal)) {
    throw new MockHttpError(403, "SHIFT_NOT_YOURS", "This shift belongs to another cashier. Ask a manager for help.");
  }
}

export function replaceShiftInDatabase(updatedShift: PosShift): void {
  const database = readMockDatabase();
  const shiftIndex = database.shifts.findIndex((candidate) => candidate.id === updatedShift.id);
  if (shiftIndex >= 0) database.shifts[shiftIndex] = updatedShift;
}

export function calculateLiveShiftTotalsAndExpectedCash(shift: PosShift): { totals: ShiftTotals; expectedCash: Money } {
  const database = readMockDatabase();
  const shiftSales = database.sales.filter((sale) => sale.shiftId === shift.id);
  const shiftSaleIds = new Set(shiftSales.map((sale) => sale.id));
  const shiftRefunds = database.refunds.filter((refund) => shiftSaleIds.has(refund.saleId));
  const amountByMethod = new Map<PaymentMethod, number>();
  let cashTakenMinor = 0;
  for (const sale of shiftSales) {
    for (const payment of sale.payments) {
      amountByMethod.set(payment.method, (amountByMethod.get(payment.method) ?? 0) + payment.amount.amountMinor);
      if (payment.method === "cash") cashTakenMinor += payment.amount.amountMinor;
    }
  }
  const grossMinor = shiftSales.reduce((sum, sale) => sum + sale.total.amountMinor, 0);
  const refundsMinor = shiftRefunds.reduce((sum, refund) => sum + refund.amount.amountMinor, 0);
  const cashRefundsMinor = shiftRefunds.filter((refund) => refund.method === "cash").reduce((sum, refund) => sum + refund.amount.amountMinor, 0);
  const movementsMinor = shift.cashMovements.reduce((sum, movement) => sum + (movement.kind === "pay_in" ? movement.amount.amountMinor : -movement.amount.amountMinor), 0);
  return {
    totals: {
      salesCount: shiftSales.length,
      grossSales: buildStoreMoney(grossMinor),
      refunds: buildStoreMoney(refundsMinor),
      netSales: buildStoreMoney(grossMinor - refundsMinor),
      byPaymentMethod: [...amountByMethod.entries()].map(([method, amountMinor]) => ({ method, amount: buildStoreMoney(amountMinor) })),
    },
    expectedCash: buildStoreMoney(shift.openingFloat.amountMinor + cashTakenMinor - cashRefundsMinor + movementsMinor),
  };
}

export function presentShiftWithLiveTotals(shift: PosShift): PosShift {
  if (shift.status === "closed") return shift;
  return { ...shift, ...calculateLiveShiftTotalsAndExpectedCash(shift) };
}

export function readRequiredString(body: Record<string, unknown>, fieldName: string, maximumLength = 128): string | null {
  const value = body[fieldName];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maximumLength ? trimmed : null;
}

export function readNonNegativeInteger(body: Record<string, unknown>, fieldName: string, maximum = 10_000_000_000): number | null {
  const value = body[fieldName];
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum ? value : null;
}

export function isPaymentMethodEnabledForStore(method: unknown): method is PaymentMethod {
  return readMockDatabase().settings.paymentMethods.some((setting) => setting.method === method && setting.enabled);
}

export function buildPrincipalActor(principal: MockPrincipal): { id: string; name: string } {
  return { id: principal.staffId ?? principal.userId, name: principal.actorName };
}
