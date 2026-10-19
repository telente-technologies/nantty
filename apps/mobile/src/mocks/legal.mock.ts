import { ApiError } from "@/errors/api.error";
import { legalLinks } from "@/config/legalLinks.config";
import type { PolicyVersionSummary } from "@/types";

import { createMockRoute, type MockRoute } from "./registry.mock";

const DAY_MS = 86_400_000;

const currentPolicyVersions: readonly PolicyVersionSummary[] = [
  { policyVersionId: "lgv_terms_1", documentKey: "terms", title: "Terms of Service", versionLabel: "1.0", summary: "First version, not yet in effect: our rules under Nigerian law, with arbitration in Lagos and clear rules on payments, coins and consumer rights.", whatChanged: ["Your wallet is held by our licensed payment partner in your name; Zudomart never holds your money.", "Escrow and buyer protection apply in Nigeria only. Outside Nigeria you pay sellers directly at your own risk.", "Nigerian law governs these terms, with arbitration seated in Lagos. Your consumer rights are not affected.", "Coins and gifts are not money, ZudoPoints are never withdrawable, and ad credit is never cash."], publishedAt: new Date(Date.now() - DAY_MS).toISOString(), effectiveAt: new Date(Date.now() + 30 * DAY_MS).toISOString(), isMaterialChange: true, documentUrl: legalLinks.terms },
  { policyVersionId: "lgv_privacy_1", documentKey: "privacy", title: "Privacy Policy", versionLabel: "1.0", summary: "First version, not yet in effect: our providers, a retention schedule and country annexes.", whatChanged: ["We never sell your personal data. We list the lawful basis for each use and name our providers, including Flutterwave, Smile ID and AWS.", "A retention schedule shows how long we keep each type of data.", "Annexes for Ghana, Kenya, South Africa, the UK, the EU and the US."], publishedAt: new Date(Date.now() - DAY_MS).toISOString(), effectiveAt: new Date(Date.now() - DAY_MS).toISOString(), isMaterialChange: false, documentUrl: legalLinks.privacyPolicy },
];

const acceptedPolicyVersionIds = new Set<string>();

export function recordMockPolicyAcceptance(policyVersionId: string): void {
  if (!currentPolicyVersions.some((version) => version.policyVersionId === policyVersionId)) throw new ApiError(422, "That policy version is not current");
  acceptedPolicyVersionIds.add(policyVersionId);
}

export const legalMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/legal/policy-versions/current", () => ({ items: currentPolicyVersions })),
  createMockRoute("GET", "/api/v1/users/me/policy-acceptances", () => ({ acceptedPolicyVersionIds: [...acceptedPolicyVersionIds] })),
];
