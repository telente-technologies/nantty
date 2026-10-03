import type { CurrentPolicyVersions, PolicyAcceptances } from "@/types/policyUpdate.type";

import { sendRequestToWebappServer } from "./clientApi.service";

export const legalService = {
  fetchCurrentPolicyVersions: () => sendRequestToWebappServer<CurrentPolicyVersions>("/api/v1/legal/policy-versions/current"),
  fetchMyPolicyAcceptances: () => sendRequestToWebappServer<PolicyAcceptances>("/api/v1/users/me/policy-acceptances"),
};
