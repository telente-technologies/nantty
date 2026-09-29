import { appendMockAuditLogEntry, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { runOnceForIdempotencyKey } from "@/mocks/mockIdempotency.mock";
import { MockHttpError, createMockIdentifier, paginateMockList, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import {
  assertPrincipalMayUseShift,
  buildPrincipalActor,
  buildStoreMoney,
  calculateLiveShiftTotalsAndExpectedCash,
  canPrincipalManageAllShifts,
  findShiftOrThrow,
  presentShiftWithLiveTotals,
  readNonNegativeInteger,
  readRequiredString,
  replaceShiftInDatabase,
} from "@/mocks/handlers/posMockHelpers.mock";
import type { PosShift } from "@/types/pos.type";

function assertShiftIsOpen(shift: PosShift): void {
  if (shift.status !== "open") throw new MockHttpError(409, "SHIFT_CLOSED", "This shift is already closed.");
}

export function registerPosShiftMockHandlers(): void {
  registerMockRoute("GET", "/seller/pos/registers", (request) => {
    requireMockStorePrincipal(request);
    const locationId = request.query.get("locationId");
    const includeInactive = request.query.get("includeInactive") === "true";
    const registers = readMockDatabase().registers.filter((register) => (includeInactive || register.active) && (!locationId || register.locationId === locationId));
    return respondWithJson(200, { data: registers, nextCursor: null });
  });

  registerMockRoute("GET", "/seller/pos/shifts", (request) => {
    const principal = requireMockStorePrincipal(request);
    const registerId = request.query.get("registerId");
    const status = request.query.get("status");
    const shifts = readMockDatabase().shifts
      .filter((shift) => (!registerId || shift.registerId === registerId) && (!status || shift.status === status))
      .filter((shift) => canPrincipalManageAllShifts(principal) || shift.openedBy.id === principal.staffId)
      .sort((first, second) => second.openedAt.localeCompare(first.openedAt))
      .map(presentShiftWithLiveTotals);
    return respondWithJson(200, paginateMockList(shifts, request.query, 20));
  });

  registerMockRoute("GET", "/seller/pos/shifts/:shiftId", (request) => {
    const principal = requireMockStorePrincipal(request);
    const shift = findShiftOrThrow(request.params.shiftId ?? "");
    assertPrincipalMayUseShift(principal, shift);
    return respondWithJson(200, presentShiftWithLiveTotals(shift));
  });

  registerMockRoute("POST", "/seller/pos/shifts", (request) => {
    const principal = requireMockStorePrincipal(request);
    const body = readJsonObjectBody(request);
    const registerId = readRequiredString(body, "registerId", 64);
    const openingFloatMinor = readNonNegativeInteger(body, "openingFloatMinor", 100_000_000_000);
    const issues = [
      ...(registerId ? [] : [{ path: "registerId", message: "Choose a register." }]),
      ...(openingFloatMinor === null ? [{ path: "openingFloatMinor", message: "Enter the cash float as a whole amount, zero or more." }] : []),
    ];
    if (issues.length > 0 || !registerId || openingFloatMinor === null) return respondWithValidationFailure(issues);
    const database = readMockDatabase();
    const registerIndex = database.registers.findIndex((register) => register.id === registerId && register.active);
    const register = database.registers[registerIndex];
    if (!register) throw new MockHttpError(404, "REGISTER_NOT_FOUND", "That register does not exist.");
    if (register.openShiftId) throw new MockHttpError(409, "SHIFT_ALREADY_OPEN", "This register already has an open shift. Close it first.");
    const shift: PosShift = {
      id: createMockIdentifier("shf"),
      registerId,
      locationId: register.locationId,
      status: "open",
      openedBy: buildPrincipalActor(principal),
      openedAt: new Date().toISOString(),
      openingFloat: buildStoreMoney(openingFloatMinor),
      cashMovements: [],
      totals: { salesCount: 0, grossSales: buildStoreMoney(0), refunds: buildStoreMoney(0), netSales: buildStoreMoney(0), byPaymentMethod: [] },
      expectedCash: buildStoreMoney(openingFloatMinor),
      closedBy: null,
      closedAt: null,
      countedCash: null,
      cashVariance: null,
      closingNote: null,
    };
    database.shifts.unshift(shift);
    database.registers[registerIndex] = { ...register, openShiftId: shift.id };
    return respondWithJson(201, shift);
  });

  registerMockRoute("POST", "/seller/pos/shifts/:shiftId/cash-movements", (request) =>
    runOnceForIdempotencyKey(request, () => {
      const principal = requireMockStorePrincipal(request);
      const shift = findShiftOrThrow(request.params.shiftId ?? "");
      assertPrincipalMayUseShift(principal, shift);
      assertShiftIsOpen(shift);
      const body = readJsonObjectBody(request);
      const kind = body.kind === "pay_in" || body.kind === "pay_out" ? body.kind : null;
      const amountMinor = readNonNegativeInteger(body, "amountMinor");
      const reason = readRequiredString(body, "reason", 200);
      const issues = [
        ...(kind ? [] : [{ path: "kind", message: "Choose pay in or pay out." }]),
        ...(amountMinor && amountMinor > 0 ? [] : [{ path: "amountMinor", message: "Enter an amount above zero." }]),
        ...(reason ? [] : [{ path: "reason", message: "Say why the cash is moving." }]),
      ];
      if (issues.length > 0 || !kind || !amountMinor || !reason) return respondWithValidationFailure(issues);
      if (kind === "pay_out" && amountMinor > calculateLiveShiftTotalsAndExpectedCash(shift).expectedCash.amountMinor) {
        throw new MockHttpError(409, "NOT_ENOUGH_CASH", "The drawer does not have that much cash.");
      }
      const updatedShift: PosShift = {
        ...shift,
        cashMovements: [...shift.cashMovements, { id: createMockIdentifier("cm"), kind, amount: buildStoreMoney(amountMinor), reason, createdBy: buildPrincipalActor(principal), createdAt: new Date().toISOString() }],
      };
      replaceShiftInDatabase(updatedShift);
      return respondWithJson(201, presentShiftWithLiveTotals(updatedShift));
    }),
  );

  registerMockRoute("POST", "/seller/pos/shifts/:shiftId/close", (request) => {
    const principal = requireMockStorePrincipal(request);
    const shift = findShiftOrThrow(request.params.shiftId ?? "");
    assertPrincipalMayUseShift(principal, shift);
    assertShiftIsOpen(shift);
    const body = readJsonObjectBody(request);
    const countedCashMinor = readNonNegativeInteger(body, "countedCashMinor");
    if (countedCashMinor === null) return respondWithValidationFailure([{ path: "countedCashMinor", message: "Enter the cash you counted in the drawer." }]);
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;
    const { totals, expectedCash } = calculateLiveShiftTotalsAndExpectedCash(shift);
    const varianceMinor = countedCashMinor - expectedCash.amountMinor;
    const closedShift: PosShift = {
      ...shift,
      status: "closed",
      totals,
      expectedCash,
      closedBy: buildPrincipalActor(principal),
      closedAt: new Date().toISOString(),
      countedCash: buildStoreMoney(countedCashMinor),
      cashVariance: buildStoreMoney(varianceMinor),
      closingNote: note,
    };
    replaceShiftInDatabase(closedShift);
    const database = readMockDatabase();
    const registerIndex = database.registers.findIndex((register) => register.id === shift.registerId);
    const register = database.registers[registerIndex];
    if (register) database.registers[registerIndex] = { ...register, openShiftId: null };
    if (varianceMinor !== 0) {
      appendMockAuditLogEntry({ actor: { id: principal.staffId ?? principal.userId, name: principal.actorName, role: principal.role ?? "cashier" }, action: "pos.shift_closed_with_variance", targetType: "shift", targetId: shift.id, summary: `Closed a shift with a cash variance of ${varianceMinor} minor units` });
    }
    return respondWithJson(200, closedShift);
  });
}
