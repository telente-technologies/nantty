import { ApiError } from "@/errors/api.error";
import type { PolicyVersionSummary } from "@/types/policyUpdate.type";

import { createMockRoute, type MockRoute } from "./registry.mock";

const dayMilliseconds = 86_400_000;
const marketingSiteUrl = process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://zudomart.com";

const currentPolicyVersions: readonly PolicyVersionSummary[] = [
  { policyVersionId: "lgv_terms_3", documentKey: "terms", title: "Terms of Service", versionLabel: "3", summary: "Rewritten under Nigerian law, with arbitration in Lagos and clearer rules on payments and consumer rights.", whatChanged: ["Your wallet is held by our licensed payment partner in your name; Zudomart never holds your money.", "Escrow and buyer protection apply in Nigeria only. Outside Nigeria you pay sellers directly at your own risk.", "Nigerian law governs these terms, with arbitration seated in Lagos. Your consumer rights are not affected.", "New Copyright and IP Policy and Data rights requests pages."], publishedAt: new Date(Date.now() - dayMilliseconds).toISOString(), effectiveAt: new Date(Date.now() + 30 * dayMilliseconds).toISOString(), isMaterialChange: true, documentUrl: `${marketingSiteUrl}/terms` },
  { policyVersionId: "lgv_privacy_3", documentKey: "privacy", title: "Privacy Policy", versionLabel: "3", summary: "Named our providers and added a retention schedule and country annexes.", whatChanged: ["We list the lawful basis for each use of your data and name our providers, including Flutterwave, Smile ID and AWS.", "A retention schedule shows how long we keep each type of data.", "Annexes for Ghana, Kenya, South Africa, the UK, the EU and the US."], publishedAt: new Date(Date.now() - dayMilliseconds).toISOString(), effectiveAt: new Date(Date.now() - dayMilliseconds).toISOString(), isMaterialChange: false, documentUrl: `${marketingSiteUrl}/privacy` },
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
