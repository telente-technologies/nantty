import type { AccountHealthSummary } from "@/types/accountHealth.type";

import { sendRequestToStudioServer } from "./clientApi.service";

export const accountHealthService = {
  fetchMine: () => sendRequestToStudioServer<AccountHealthSummary>("/api/v1/account/status"),
};

export const accountStandingLabel = (status: AccountHealthSummary["status"]) => ({ GOOD_STANDING: "Good standing", AT_RISK: "At risk", RESTRICTED: "Restricted" })[status];
