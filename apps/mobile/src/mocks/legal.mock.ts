import { ApiError } from "@/errors/api.error";
import { legalLinks } from "@/config/legalLinks.config";
import type { PolicyVersionSummary } from "@/types";

import { createMockRoute, type MockRoute } from "./registry.mock";

const DAY_MS = 86_400_000;

const currentPolicyVersions: readonly PolicyVersionSummary[] = [
  { policyVersionId: "lgv_terms_3", documentKey: "terms", title: "Terms of Service", versionLabel: "3", summary: "Added a contact address and clarified the username rules.", publishedAt: new Date(Date.now() - DAY_MS).toISOString(), effectiveAt: new Date(Date.now() + 30 * DAY_MS).toISOString(), isMaterialChange: true, documentUrl: legalLinks.terms },
  { policyVersionId: "lgv_privacy_3", documentKey: "privacy", title: "Privacy Policy", versionLabel: "3", summary: "Fixed typos in the data retention section.", publishedAt: new Date(Date.now() - DAY_MS).toISOString(), effectiveAt: new Date(Date.now() - DAY_MS).toISOString(), isMaterialChange: false, documentUrl: legalLinks.privacyPolicy },
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
