import { findNigeriaGeoStateByName, nigeriaGeoStates } from "@/constants/nigeriaGeo.constant";
import { findOrderIndexOrThrow } from "@/mocks/handlers/orderMockHelpers.mock";
import { readMockDatabase, readStoreScopedMockSlice } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockIdentifier, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithNoContent, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import { buildDemoShippingProfile } from "@/mocks/seed/demoShippingProfile.mock";
import type { ShippingCalculationSnapshot, ShippingDestination, ShippingProfile } from "@/types/shipping.type";
import type { ValidationIssue } from "@/utils/formValidation.util";
import { calculateShippingForOrderGroup } from "@/utils/shippingCalculation.util";

const maxRulesPerProfile = 50;

function readShippingProfile(): ShippingProfile {
  return readStoreScopedMockSlice("shippingProfile", () => buildDemoShippingProfile(readMockDatabase().settings.currency));
}

function isValidDestination(candidate: unknown): candidate is ShippingDestination {
  if (typeof candidate !== "object" || candidate === null) return false;
  const destination = candidate as Record<string, unknown>;
  if (destination.countryCode !== "NG") return false;
  if (destination.level === "country") return true;
  const geoState = nigeriaGeoStates.find((state) => state.code === destination.stateCode);
  if (!geoState) return false;
  if (destination.level === "state") return true;
  return destination.level === "lga" && typeof destination.lgaName === "string" && geoState.localGovernmentAreas.includes(destination.lgaName);
}

function validateRuleBody(body: Record<string, unknown>) {
  const issues: ValidationIssue[] = [];
  const zoneName = String(body.zoneName ?? "").trim();
  const feeMinor = body.type === "free" ? 0 : Number(body.feeMinor);
  const destinations = Array.isArray(body.destinations) ? body.destinations : [];
  if (zoneName.length < 2 || zoneName.length > 60) issues.push({ path: "zoneName", message: "Name the destination group (2–60 characters)." });
  if (body.type !== "flat_fee" && body.type !== "free") issues.push({ path: "type", message: "Choose a flat fee or free shipping." });
  if (!Number.isSafeInteger(feeMinor) || feeMinor < 0 || feeMinor > 100_000_000) issues.push({ path: "feeMinor", message: "Enter a shipping fee of zero or more." });
  if (destinations.length === 0 || !destinations.every(isValidDestination)) issues.push({ path: "destinations", message: "Choose at least one destination." });
  return { issues, zoneName, feeMinor, destinations: destinations as ShippingDestination[], type: body.type as "flat_fee" | "free", active: body.active !== false };
}

function readCustomerLocation(stateName: string, cityName: string) {
  const geoState = findNigeriaGeoStateByName(stateName);
  if (!geoState) return null;
  const lgaName = geoState.localGovernmentAreas.find((candidate) => candidate.toLowerCase() === cityName.trim().toLowerCase()) ?? null;
  return { stateCode: geoState.code, lgaName };
}

function registerShippingProfileHandlers(): void {
  registerMockRoute("GET", "/seller/shipping/profile", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, readShippingProfile());
  });

  registerMockRoute("PATCH", "/seller/shipping/profile", (request) => {
    requireMockStorePrincipal(request);
    const profile = readShippingProfile();
    const body = readJsonObjectBody(request);
    if (!("freeShippingThresholdMinor" in body)) return respondWithValidationFailure([{ path: "freeShippingThresholdMinor", message: "Send a threshold or null to turn it off." }]);
    const thresholdMinor = body.freeShippingThresholdMinor === null ? null : Number(body.freeShippingThresholdMinor);
    if (thresholdMinor !== null && (!Number.isSafeInteger(thresholdMinor) || thresholdMinor <= 0 || thresholdMinor > 100_000_000_000)) return respondWithValidationFailure([{ path: "freeShippingThresholdMinor", message: "Enter an order total above zero." }]);
    Object.assign(profile, { freeShippingThreshold: thresholdMinor === null ? null : { amountMinor: thresholdMinor, currency: profile.currency }, updatedAt: new Date().toISOString() });
    return respondWithJson(200, profile);
  });

  registerMockRoute("GET", "/seller/shipping/preview", (request) => {
    requireMockStorePrincipal(request);
    const profile = readShippingProfile();
    const stateCode = request.query.get("stateCode") ?? "";
    const orderTotalMinor = Number(request.query.get("orderTotalMinor"));
    if (!nigeriaGeoStates.some((state) => state.code === stateCode)) return respondWithValidationFailure([{ path: "stateCode", message: "Choose a Nigerian state." }]);
    if (!Number.isSafeInteger(orderTotalMinor) || orderTotalMinor < 0) return respondWithValidationFailure([{ path: "orderTotalMinor", message: "Enter an order total of zero or more." }]);
    return respondWithJson(200, calculateShippingForOrderGroup(profile, { stateCode, lgaName: request.query.get("lgaName") }, { amountMinor: orderTotalMinor, currency: profile.currency }));
  });
}

function registerShippingRuleHandlers(): void {
  registerMockRoute("POST", "/seller/shipping/rules", (request) => {
    requireMockStorePrincipal(request);
    const profile = readShippingProfile();
    const { issues, zoneName, feeMinor, destinations, type, active } = validateRuleBody(readJsonObjectBody(request));
    if (issues.length > 0) return respondWithValidationFailure(issues);
    if (profile.rules.length >= maxRulesPerProfile) throw new MockHttpError(409, "RULE_LIMIT_REACHED", `You can have up to ${maxRulesPerProfile} shipping rules.`);
    const zone = { id: createMockIdentifier("zone"), name: zoneName, destinations };
    const rule = { id: createMockIdentifier("rule"), zoneId: zone.id, type, fee: { amountMinor: feeMinor, currency: profile.currency }, active };
    profile.zones.push(zone);
    profile.rules.push(rule);
    return respondWithJson(201, { zone, rule });
  });

  registerMockRoute("PATCH", "/seller/shipping/rules/:ruleId", (request) => {
    requireMockStorePrincipal(request);
    const profile = readShippingProfile();
    const ruleIndex = profile.rules.findIndex((rule) => rule.id === request.params.ruleId);
    const current = profile.rules[ruleIndex];
    const zoneIndex = profile.zones.findIndex((zone) => zone.id === current?.zoneId);
    const currentZone = profile.zones[zoneIndex];
    if (!current || !currentZone) throw new MockHttpError(404, "RULE_NOT_FOUND", "That shipping rule no longer exists.");
    const merged = { zoneName: currentZone.name, destinations: currentZone.destinations, type: current.type, feeMinor: current.fee.amountMinor, active: current.active, ...readJsonObjectBody(request) };
    const { issues, zoneName, feeMinor, destinations, type, active } = validateRuleBody(merged);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const zone = { ...currentZone, name: zoneName, destinations };
    const rule = { ...current, type, fee: { amountMinor: feeMinor, currency: profile.currency }, active };
    profile.zones[zoneIndex] = zone;
    profile.rules[ruleIndex] = rule;
    return respondWithJson(200, { zone, rule });
  });

  registerMockRoute("DELETE", "/seller/shipping/rules/:ruleId", (request) => {
    requireMockStorePrincipal(request);
    const profile = readShippingProfile();
    const ruleIndex = profile.rules.findIndex((rule) => rule.id === request.params.ruleId);
    const rule = profile.rules[ruleIndex];
    if (!rule) throw new MockHttpError(404, "RULE_NOT_FOUND", "That shipping rule no longer exists.");
    profile.rules.splice(ruleIndex, 1);
    profile.zones.splice(profile.zones.findIndex((zone) => zone.id === rule.zoneId), 1);
    return respondWithNoContent();
  });
}

export function registerShippingMockHandlers(): void {
  registerShippingProfileHandlers();
  registerShippingRuleHandlers();

  registerMockRoute("GET", "/seller/orders/:orderId/shipping-snapshot", (request) => {
    requireMockStorePrincipal(request);
    const order = readMockDatabase().onlineOrders[findOrderIndexOrThrow(request.params.orderId ?? "")];
    if (!order) throw new MockHttpError(404, "ORDER_NOT_FOUND", "That order does not exist in your store.");
    const profile = readShippingProfile();
    const location = readCustomerLocation(order.shippingAddress.state, order.shippingAddress.city);
    const calculation = location ? calculateShippingForOrderGroup(profile, location, order.subtotal) : null;
    const wasFreeShipped = order.shippingFee.amountMinor === 0;
    const snapshot: ShippingCalculationSnapshot = {
      orderId: order.id,
      destinationLabel: `${order.shippingAddress.city}, ${order.shippingAddress.state}`,
      orderSubtotal: order.subtotal,
      feeCharged: order.shippingFee,
      calculatedAt: order.paidAt ?? order.createdAt,
      outcome: calculation?.outcome ?? (wasFreeShipped ? "free_rule" : "fee"),
      fee: calculation?.fee ?? order.shippingFee,
      ruleId: calculation?.ruleId ?? null,
      zoneName: calculation?.zoneName ?? null,
      matchedLevel: calculation?.matchedLevel ?? null,
      thresholdApplied: calculation?.thresholdApplied ?? null,
    };
    return respondWithJson(200, snapshot);
  });
}
