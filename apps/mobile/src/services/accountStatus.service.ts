import type { SuspensionNotice } from "@/types/trust.type";

import { api } from "./apiClient.service";

export const accountStatusService = {
  fetchMySuspensionNotice: () => api.get<SuspensionNotice>("/api/v1/users/me/suspension"),
};
