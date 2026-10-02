import type { CreatorDashboard, CreatorDashboardPeriod } from "@/types/creator.type";

import { sendRequestToWebappServer } from "./clientApi.service";

export const creatorProgramService = {
  fetchCreatorDashboard: (period: CreatorDashboardPeriod) =>
    sendRequestToWebappServer<CreatorDashboard>("/api/v1/creators/dashboard", { query: { period } }),
};
