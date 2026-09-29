import type { Page } from "@/types";
import type {
  CreatorAffiliation,
  CreatorAffiliationRequest,
  CreatorApplication,
  CreatorApplicationInput,
  CreatorDashboard,
  CreatorDashboardPeriod,
  CreatorEarning,
  CreatorEligibility,
} from "@/types/creator.type";

import { api } from "./apiClient.service";

export const creatorProgramService = {
  fetchMyCreatorEligibility: () => api.get<CreatorEligibility>("/api/v1/creators/eligibility"),
  fetchMyCreatorApplication: () => api.get<CreatorApplication | null>("/api/v1/creators/applications/me"),
  submitCreatorApplication: (input: CreatorApplicationInput, idempotencyKey: string) =>
    api.post<CreatorApplication>("/api/v1/creators/applications", input, { idempotencyKey }),
  fetchCreatorDashboard: (period: CreatorDashboardPeriod) => api.get<CreatorDashboard>("/api/v1/creators/dashboard", { period }),
  listMyAffiliations: () => api.get<CreatorAffiliation[]>("/api/v1/creators/affiliations"),
  requestAffiliation: (request: CreatorAffiliationRequest) => api.post<CreatorAffiliation>("/api/v1/creators/affiliations", request),
  fetchCreatorEarningsPage: (cursor: string | null) =>
    api.get<Page<CreatorEarning>>("/api/v1/creators/earnings", { cursor: cursor ?? undefined }),
};
