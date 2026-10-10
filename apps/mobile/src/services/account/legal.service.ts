import type { CurrentPolicyVersions, PolicyAcceptances, PolicyVersionSummary } from "@/types";

import { api } from "../core/apiClient.service";
import { consentsService } from "./consents.service";

export const legalService = {
  fetchCurrentPolicyVersions: () => api.get<CurrentPolicyVersions>("/api/v1/legal/policy-versions/current"),
  fetchMyPolicyAcceptances: () => api.get<PolicyAcceptances>("/api/v1/users/me/policy-acceptances"),
  acceptPolicyVersion: (version: PolicyVersionSummary) => consentsService.updateMyConsents({ policyVersionId: version.policyVersionId, consents: {} }),
};
