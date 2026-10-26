import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { createMockId, failConflict, failNotFound, failValidation, readEnumValue, readIsoNow, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { OfferLink } from "@/types/subscriptionOffers.type";
import { isPlausibleEmail, offerPlanOptions } from "@/utils/offerLinkFormat.util";

const offerLinks: OfferLink[] = [];

function readWholeNumber(body: Record<string, unknown>, key: string, minimum: number, maximum: number): number {
  const value = body[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) failValidation(key, `Use a whole number from ${minimum} to ${maximum}.`);
  return value;
}

function readPlanCodes(value: unknown): string[] {
  const codes = Array.isArray(value) ? value.filter((code): code is string => typeof code === "string") : [];
  if (codes.length === 0 || new Set(codes).size !== codes.length || codes.some((code) => !offerPlanOptions.some((option) => option.value === code))) failValidation("planCodes", "must be distinct purchasable plan codes");
  return codes;
}

function findOfferLink(id: string | undefined): OfferLink {
  const link = offerLinks.find((candidate) => candidate.id === id);
  if (!link) failNotFound("Offer link");
  return link;
}

function replaceOfferLink(next: OfferLink): OfferLink {
  offerLinks.splice(offerLinks.findIndex((link) => link.id === next.id), 1, next);
  return next;
}

export function registerSubscriptionOfferLinkMockHandlers(): void {
  registerMockRoute("GET", "/admin/subscriptions/offer-links", (request) => {
    requireMockPermission(request, "config:read", "config:plans", "config:revenue");
    return respondWithJson(200, { data: offerLinks, nextCursor: null });
  });

  registerMockRoute("POST", "/admin/subscriptions/offer-links", (request) => {
    const principal = requireMockPermission(request, "config:plans", "config:revenue");
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    const planCodes = readPlanCodes(body.planCodes);
    const kind = readEnumValue(body, "discountKind", ["percentage", "fixed_amount"] as const);
    const amountOff = body.amountOff as { amountMinor?: unknown; currency?: unknown } | undefined;
    if (kind === "fixed_amount" && !(typeof amountOff?.amountMinor === "number" && amountOff.amountMinor > 0 && typeof amountOff.currency === "string" && /^[A-Z]{3}$/.test(amountOff.currency))) failValidation("amountOff", "is required for a fixed amount discount");
    const singleUse = body.singleUse === true;
    const id = createMockId("offer");
    const link: OfferLink = {
      id, label: typeof body.label === "string" ? body.label.slice(0, 120) : "", url: `https://nantty.com/offer/${id.replace(/[^A-Za-z0-9]/g, "").padEnd(43, "x").slice(0, 43)}`, status: "active",
      plans: planCodes.map((planCode) => ({ planCode, planLabel: planCode })),
      discount: kind === "percentage" ? { kind, percentOff: readWholeNumber(body, "percentOff", 1, 100) } : { kind, amountOff: { amountMinor: amountOff!.amountMinor as number, currency: amountOff!.currency as string } },
      singleUse, maxClaims: singleUse ? 1 : readWholeNumber(body, "maxClaims", 1, 100_000), claimedCount: 0, redeemedCount: 0, durationCycles: readWholeNumber(body, "durationCycles", 1, 36),
      expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : null, revokedAt: null, createdByStaffId: principal.adminId, createdAt: readIsoNow(), sends: [], claims: [],
    };
    offerLinks.unshift(link);
    recordMockAuditEntry(request, { action: "subscriptions.offer_link.create", area: "config", target: { type: "subscriptionOfferLink", id, label: link.label || id }, reason, before: null, after: link });
    return respondWithJson(201, link);
  });

  registerMockRoute("POST", "/admin/subscriptions/offer-links/:id/revoke", (request) => {
    requireMockPermission(request, "config:plans", "config:revenue");
    requireMockStepUp(request);
    const reason = readRequiredReason(readJsonObjectBody(request));
    const before = findOfferLink(request.params.id);
    const after = replaceOfferLink({ ...before, status: "revoked", revokedAt: before.revokedAt ?? readIsoNow() });
    recordMockAuditEntry(request, { action: "subscriptions.offer_link.revoke", area: "config", target: { type: "subscriptionOfferLink", id: after.id, label: after.label || after.id }, reason, before, after });
    return respondWithJson(200, after);
  });

  registerMockRoute("POST", "/admin/subscriptions/offer-links/:id/sends", (request) => {
    const principal = requireMockPermission(request, "config:plans", "config:revenue");
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    const link = findOfferLink(request.params.id);
    if (link.status !== "active") failConflict("OFFER_LINK_NOT_ACTIVE", "This offer link is revoked, expired or fully claimed, so it can't be sent.");
    const emails = [...new Set((Array.isArray(body.recipientEmails) ? body.recipientEmails : []).map((email) => String(email).trim().toLowerCase()))];
    if (emails.length === 0 || emails.length > 20 || emails.some((email) => !isPlausibleEmail(email))) failValidation("recipientEmails", "add between 1 and 20 email addresses");
    const note = typeof body.note === "string" ? body.note : "";
    if (note.length > 500) failValidation("note", "must be plain text of at most 500 characters");
    const sends = emails.map((recipientEmail) => ({ id: createMockId("send"), recipientEmail, note, sentByStaffId: principal.adminId, sentAt: readIsoNow() }));
    replaceOfferLink({ ...link, sends: [...sends, ...link.sends] });
    recordMockAuditEntry(request, { action: "subscriptions.offer_link.send", area: "config", target: { type: "subscriptionOfferLink", id: link.id, label: link.label || link.id }, reason, before: null, after: { recipientEmails: emails, note } });
    return respondWithJson(201, { data: sends, nextCursor: null });
  });
}
