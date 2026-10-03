import { ApiError } from "@/errors/api.error";
import type { PolicyVersionSummary } from "@/types/policyUpdate.type";

import { createMockRoute, type MockRoute } from "./registry.mock";

const dayMilliseconds = 86_400_000;
const marketingSiteUrl = process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://zudomart.com";

const currentPolicyVersions: readonly PolicyVersionSummary[] = [
  { policyVersionId: "lgv_terms_3", documentKey: "terms", title: "Terms of Service", versionLabel: "3", summary: "Added a contact address and clarified the username rules.", whatChanged: ["We added a postal address for legal notices.", "Usernames can now be changed once every 30 days.", "Clearer rules on impersonation and reserved names."], publishedAt: new Date(Date.now() - dayMilliseconds).toISOString(), effectiveAt: new Date(Date.now() + 30 * dayMilliseconds).toISOString(), isMaterialChange: true, documentUrl: `${marketingSiteUrl}/terms` },
  { policyVersionId: "lgv_privacy_3", documentKey: "privacy", title: "Privacy Policy", versionLabel: "3", summary: "Fixed typos in the data retention section.", whatChanged: ["Fixed typos in the data retention section. Nothing about how we use your data has changed."], publishedAt: new Date(Date.now() - dayMilliseconds).toISOString(), effectiveAt: new Date(Date.now() - dayMilliseconds).toISOString(), isMaterialChange: false, documentUrl: `${marketingSiteUrl}/privacy` },
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
