import { buildMockAuditActor } from "@/mocks/handlers/orderHandlers.mock";
import { appendMockAuditLogEntry, readMockDatabase } from "@/mocks/mockDatabase.mock";
import {
  MockHttpError,
  createMockIdentifier,
  matchesSearchText,
  paginateMockList,
  readJsonObjectBody,
  requireMockStorePrincipal,
  respondWithJson,
  respondWithValidationFailure,
} from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { OrderDispute, ReturnRequest, ReturnRequestStatus } from "@/types/order.type";

const allowedReturnTransitions: Record<"approve" | "decline" | "receive", { from: ReturnRequestStatus[]; to: ReturnRequestStatus }> = {
  approve: { from: ["requested"], to: "approved" },
  decline: { from: ["requested"], to: "declined" },
  receive: { from: ["approved"], to: "refunded" },
};

function findReturnIndexOrThrow(returnId: string): number {
  const returnIndex = readMockDatabase().returnRequests.findIndex((returnRequest) => returnRequest.id === returnId);
  if (returnIndex < 0) throw new MockHttpError(404, "RETURN_NOT_FOUND", "That return does not exist in your store.");
  return returnIndex;
}

function findDisputeIndexOrThrow(disputeId: string): number {
  const disputeIndex = readMockDatabase().disputes.findIndex((dispute) => dispute.id === disputeId);
  if (disputeIndex < 0) throw new MockHttpError(404, "DISPUTE_NOT_FOUND", "That dispute does not exist in your store.");
  return disputeIndex;
}

function restockReturnedLines(returnRequest: ReturnRequest, locationId: string): void {
  const database = readMockDatabase();
  const order = database.onlineOrders.find((candidate) => candidate.id === returnRequest.orderId);
  if (!order) return;
  for (const returnedLine of returnRequest.lines) {
    const orderLine = order.lines.find((line) => line.id === returnedLine.orderLineId);
    if (!orderLine) continue;
    const productIndex = database.products.findIndex((product) => product.id === orderLine.productId);
    const product = database.products[productIndex];
    if (!product) continue;
    database.products[productIndex] = {
      ...product,
      variants: product.variants.map((variant) =>
        variant.id !== orderLine.variantId
          ? variant
          : { ...variant, stock: variant.stock.map((level) => (level.locationId === locationId ? { ...level, onHand: level.onHand + returnedLine.quantity } : level)) },
      ),
    };
  }
}

function registerReturnHandlers(): void {
  registerMockRoute("GET", "/seller/returns", (request) => {
    requireMockStorePrincipal(request);
    const status = request.query.get("status");
    const returns = readMockDatabase().returnRequests.filter(
      (returnRequest) => (!status || status === "all" || returnRequest.status === status) && matchesSearchText(request.query.get("q"), returnRequest.orderNumber, returnRequest.buyerName),
    );
    return respondWithJson(200, paginateMockList(returns, request.query));
  });

  for (const action of ["approve", "decline", "receive"] as const) {
    registerMockRoute("POST", `/seller/returns/:returnId/${action}`, (request) => {
      const principal = requireMockStorePrincipal(request);
      const database = readMockDatabase();
      const returnIndex = findReturnIndexOrThrow(request.params.returnId ?? "");
      const returnRequest = database.returnRequests[returnIndex] as ReturnRequest;
      const transition = allowedReturnTransitions[action];
      if (!transition.from.includes(returnRequest.status)) throw new MockHttpError(409, "RETURN_STATE_CONFLICT", `This return is ${returnRequest.status} and cannot be ${action === "receive" ? "received" : `${action}d`} now.`);
      const body = (request.jsonBody ?? {}) as { restock?: unknown; locationId?: unknown; note?: unknown };
      if (action === "decline" && (typeof body.note !== "string" || body.note.trim().length < 5)) {
        return respondWithValidationFailure([{ path: "note", message: "Tell the buyer why you are declining (at least 5 characters)." }]);
      }
      if (action === "receive" && body.restock === true) {
        const locationId = typeof body.locationId === "string" ? body.locationId : "";
        if (!database.locations.some((location) => location.id === locationId)) return respondWithValidationFailure([{ path: "locationId", message: "Choose where to put the items back." }]);
        restockReturnedLines(returnRequest, locationId);
      }
      const updated: ReturnRequest = { ...returnRequest, status: transition.to };
      database.returnRequests[returnIndex] = updated;
      appendMockAuditLogEntry({ actor: buildMockAuditActor(principal), action: `return.${action}`, targetType: "return", targetId: updated.id, summary: `${action === "receive" ? "Received and refunded" : action === "approve" ? "Approved" : "Declined"} return for ${updated.orderNumber}` });
      return respondWithJson(200, updated);
    });
  }
}

export function registerOrderReturnAndDisputeMockHandlers(): void {
  registerReturnHandlers();

  registerMockRoute("GET", "/seller/disputes", (request) => {
    requireMockStorePrincipal(request);
    const status = request.query.get("status");
    const disputes = readMockDatabase().disputes.filter((dispute) => !status || status === "all" || dispute.status === status);
    return respondWithJson(200, paginateMockList(disputes, request.query));
  });

  registerMockRoute("GET", "/seller/disputes/:disputeId", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, readMockDatabase().disputes[findDisputeIndexOrThrow(request.params.disputeId ?? "")]);
  });

  registerMockRoute("POST", "/seller/disputes/:disputeId/responses", (request) => {
    const principal = requireMockStorePrincipal(request);
    const database = readMockDatabase();
    const disputeIndex = findDisputeIndexOrThrow(request.params.disputeId ?? "");
    const dispute = database.disputes[disputeIndex] as OrderDispute;
    const messageBody = String(readJsonObjectBody(request).body ?? "").trim();
    if (messageBody.length < 10 || messageBody.length > 2000) return respondWithValidationFailure([{ path: "body", message: "Write your response (10–2,000 characters)." }]);
    if (dispute.status === "resolved_for_buyer" || dispute.status === "resolved_for_seller") throw new MockHttpError(409, "DISPUTE_CLOSED", "This dispute is already resolved.");
    const updated: OrderDispute = {
      ...dispute,
      status: "under_review",
      messages: [...dispute.messages, { id: createMockIdentifier("dm"), from: "seller", body: messageBody, createdAt: new Date().toISOString() }],
    };
    database.disputes[disputeIndex] = updated;
    appendMockAuditLogEntry({ actor: buildMockAuditActor(principal), action: "dispute.responded", targetType: "dispute", targetId: dispute.id, summary: `Responded to the dispute on ${dispute.orderNumber}` });
    return respondWithJson(201, updated);
  });
}
