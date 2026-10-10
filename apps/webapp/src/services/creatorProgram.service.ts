import type {
  CreatorApplication,
  CreatorApplicationInput,
  CreatorDashboard,
  CreatorDashboardPeriod,
  CreatorEarning,
  CreatorEligibility,
  CreatorRevenueRules,
} from "@/types/creator.type";
import type { Page as GenericPage } from "@/types";

import { createIdempotencyKey, sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export const creatorProgramService = {
  fetchCreatorDashboard: (period: CreatorDashboardPeriod) =>
    sendRequestToWebappServer<CreatorDashboard>("/api/v1/creators/dashboard", { query: { period } }),
  fetchMyCreatorEligibility: () => sendRequestToWebappServer<CreatorEligibility>("/api/v1/creators/eligibility"),
  fetchMyCreatorApplication: () => sendRequestToWebappServer<CreatorApplication | null>("/api/v1/creators/applications/me"),
  submitCreatorApplication: (input: CreatorApplicationInput) =>
    sendRequestToWebappServer<CreatorApplication>("/api/v1/creators/applications", { method: "POST", body: input, idempotencyKey: createIdempotencyKey("creator-apply") }),
  fetchCreatorRevenueRules: () => sendRequestToWebappServer<CreatorRevenueRules>("/api/v1/creators/revenue-rules"),
  fetchCreatorEarningsPage: (cursor: string | null) =>
    sendRequestToWebappServer<GenericPage<CreatorEarning>>("/api/v1/creators/earnings", { query: { cursor: cursor ?? undefined } }),
  listMyCreatorEarnings: () => sendListRequestToWebappServer<CreatorEarning>("/api/v1/creators/earnings"),
};

export type { CreatorApplication, CreatorApplicationInput, CreatorEligibility, CreatorRevenueRules };
