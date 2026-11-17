import { describe, expect, it } from "vitest";

import { classifyCompletedRequest, convertPathToRouteTemplate, isTamperedConsumerToken, truncateIpToPrefix } from "../src/services/security/accessProbeClassifier.service.js";
import { AccessProbeDetector, defaultProbeThresholds } from "../src/services/security/accessProbeDetector.service.js";
import { InMemorySecurityStore } from "../src/services/security/securityStore.service.js";
import type { AccessViolationEvidence, ChallengeState, TrustSecurityClient } from "../src/services/security/securitySignalSink.service.js";

class RecordingTrust implements TrustSecurityClient {
  public readonly violations: AccessViolationEvidence[] = [];
  public async reportAccessViolation(evidence: AccessViolationEvidence): Promise<void> { this.violations.push(evidence); }
  public async reportChallengeOutcome(): Promise<ChallengeState> { return { requirement: "none" }; }
  public async readChallengeState(): Promise<ChallengeState> { return { requirement: "none" }; }
}

const principal = { accountId: "11111111-1111-4111-8111-111111111111", sessionId: "session-1", roles: [] };
const orderId = (index: number) => `0192f6a0-0000-7000-8000-${String(index).padStart(12, "0")}`;
const base64Url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const unsignedToken = (claims: object) => `${base64Url({ alg: "EdDSA" })}.${base64Url(claims)}.c2lnbmF0dXJl`;

describe("probe classification", () => {
  it("templates identifiers and never keeps the query string", () => {
    expect(convertPathToRouteTemplate(`/api/v1/orders/${orderId(7)}`).template).toBe("/api/v1/orders/:id");
    expect(convertPathToRouteTemplate("/api/v1/seller/orders/12345/items").template).toBe("/api/v1/seller/orders/:id/items");
  });

  it("counts 404s and 403s on other people's private resources but not public social privacy walls", () => {
    expect(classifyCompletedRequest({ path: `/api/v1/orders/${orderId(1)}`, status: 404, hasConsumerPrincipal: true })?.kind).toBe("privateNotFound");
    expect(classifyCompletedRequest({ path: `/api/v1/conversations/${orderId(1)}/messages`, status: 403, hasConsumerPrincipal: true })?.kind).toBe("forbidden");
    expect(classifyCompletedRequest({ path: `/api/v1/seller/conversations/${orderId(1)}`, status: 403, hasConsumerPrincipal: true })?.resourceType).toBe("sellerConversation");
    expect(classifyCompletedRequest({ path: `/api/v1/seller/wallet/payouts/${orderId(1)}`, status: 404, hasConsumerPrincipal: true })?.resourceType).toBe("sellerWallet");
    expect(classifyCompletedRequest({ path: `/api/v1/developer/organizations/${orderId(1)}/applications`, status: 403, hasConsumerPrincipal: true })?.resourceType).toBe("developerResource");
    expect(classifyCompletedRequest({ path: `/api/v1/posts/${orderId(1)}`, status: 403, hasConsumerPrincipal: true })).toBeUndefined();
    expect(classifyCompletedRequest({ path: "/api/v1/orders", status: 404, hasConsumerPrincipal: true })).toBeUndefined();
    expect(classifyCompletedRequest({ path: `/api/v1/orders/${orderId(1)}`, status: 200, hasConsumerPrincipal: true })).toBeUndefined();
  });

  it("classifies additional private business, sandbox, and platform resources", () => {
    const paths = [
      ["/api/v1/seller/analytics/", "sellerAnalytics"], ["/api/v1/seller/segments/", "sellerSegment"],
      ["/api/v1/seller/marketing/", "sellerMarketing"], ["/api/v1/seller/shipping/", "sellerShipping"],
      ["/api/v1/seller/affiliates/", "sellerAffiliate"], ["/api/v1/seller/business-documents/", "sellerBusinessDocument"],
      ["/api/v1/sandbox/", "sandboxResource"], ["/api/v1/lives/", "live"], ["/api/v1/spaces/", "space"],
      ["/api/v1/escrows/", "escrow"], ["/api/v1/cart/", "cart"], ["/api/v1/verification/", "verification"],
      ["/api/v1/invitations/", "invitation"],
    ] as const;
    for (const [prefix, resourceType] of paths) {
      expect(classifyCompletedRequest({ path: `${prefix}${orderId(8)}`, status: 403, hasConsumerPrincipal: true })?.resourceType).toBe(resourceType);
    }
  });

  it("flags consumer tokens on admin routes and replayed idempotency keys", () => {
    expect(classifyCompletedRequest({ path: "/api/v1/admin/users", status: 403, hasConsumerPrincipal: true })?.kind).toBe("adminRoute");
    expect(classifyCompletedRequest({ path: "/api/v1/admin/users", status: 403, hasConsumerPrincipal: false })).toBeUndefined();
    expect(classifyCompletedRequest({ path: "/api/v1/orders", status: 422, hasConsumerPrincipal: true, responseCode: "IDEMPOTENCY_KEY_REUSED" })?.kind).toBe("idempotencyMismatch");
  });

  it("treats unexpired consumer tokens with bad signatures as tampered, but not expired or staff tokens", () => {
    const now = 1_800_000_000;
    expect(isTamperedConsumerToken(unsignedToken({ aud: "nantty-api", exp: now + 600 }), "nantty-api", now)).toBe(true);
    expect(isTamperedConsumerToken(unsignedToken({ aud: "nantty-api", exp: now - 600 }), "nantty-api", now)).toBe(false);
    expect(isTamperedConsumerToken(unsignedToken({ aud: "nantty-staff", exp: now + 600 }), "nantty-api", now)).toBe(false);
  });

  it("keeps only a network prefix of the client address", () => {
    expect(truncateIpToPrefix("102.89.34.17")).toBe("102.89.34.0/24");
    expect(truncateIpToPrefix("2001:db8:85a3::8a2e:370:7334")).toBe("2001:db8:85a3::/48");
  });
});

describe("probe detector thresholds", () => {
  it("reports private 404s only once the window threshold is crossed, and only once per cooldown", async () => {
    const trust = new RecordingTrust();
    const detector = new AccessProbeDetector(new InMemorySecurityStore(), trust, { ...defaultProbeThresholds, idEnumeration: { count: 1000, windowSeconds: 300 } });
    const observe = (index: number) => detector.observe({ signal: { kind: "privateNotFound", routeTemplate: "/api/v1/orders/:id", resourceType: "order", resourceId: orderId(index) }, principal, deviceId: "device-a", clientIp: "102.89.34.17", requestId: `r${index}` });
    for (let index = 1; index < defaultProbeThresholds.privateNotFound.count; index += 1) expect(await observe(index)).toEqual([]);
    expect(await observe(15)).toEqual(["privateNotFound"]);
    expect(await observe(16)).toEqual([]);
    expect(trust.violations).toHaveLength(1);
    const evidence = trust.violations[0]!;
    expect(evidence).toMatchObject({ accountId: principal.accountId, kind: "privateNotFound", routeTemplate: "/api/v1/orders/:id", resourceType: "order", windowCount: 15, threshold: 15, ipPrefix: "102.89.34.0/24" });
    expect(JSON.stringify(evidence)).not.toContain(orderId(15));
  });

  it("detects sequential id enumeration from distinct resource ids", async () => {
    const trust = new RecordingTrust();
    const detector = new AccessProbeDetector(new InMemorySecurityStore(), trust);
    const reported: string[] = [];
    for (let index = 1; index <= defaultProbeThresholds.idEnumeration.count; index += 1) {
      reported.push(...await detector.observe({ signal: { kind: "forbidden", routeTemplate: "/api/v1/seller/orders/:id", resourceType: "sellerOrder", resourceId: String(1000 + index) }, principal, deviceId: undefined, clientIp: "10.0.0.1", requestId: `r${index}` }));
    }
    expect(reported).toEqual(["forbidden", "idEnumeration"]);
    expect(trust.violations.find((violation) => violation.kind === "idEnumeration")?.distinctResources).toBe(defaultProbeThresholds.idEnumeration.count);
  });

  it("repeating the same missing id does not look like enumeration", async () => {
    const trust = new RecordingTrust();
    const detector = new AccessProbeDetector(new InMemorySecurityStore(), trust);
    for (let index = 0; index < 14; index += 1) {
      await detector.observe({ signal: { kind: "privateNotFound", routeTemplate: "/api/v1/orders/:id", resourceType: "order", resourceId: orderId(1) }, principal, deviceId: undefined, clientIp: undefined, requestId: `r${index}` });
    }
    expect(trust.violations).toEqual([]);
  });
});
