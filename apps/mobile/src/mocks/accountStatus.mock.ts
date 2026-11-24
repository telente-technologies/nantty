import { ApiError } from "@/errors/api.error";
import type { SuspensionNotice } from "@/types/trust.type";

import { getSignedInMockUser } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const DAY_IN_MS = 86_400_000;
const RETENTION_DAYS = 120;
const SUSPENDED_DAYS_AGO = 9;

export const accountStatusMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/me/suspension", (): SuspensionNotice => {
    if (getSignedInMockUser().account?.status !== "suspended") throw new ApiError(404, "Your account is active");
    const suspendedAt = Date.now() - SUSPENDED_DAYS_AGO * DAY_IN_MS;
    return {
      reason: "Repeated listings that were reported as counterfeit and didn't follow our Community Guidelines.",
      suspendedAt: new Date(suspendedAt).toISOString(),
      deletionScheduledFor: new Date(suspendedAt + RETENTION_DAYS * DAY_IN_MS).toISOString(),
      retentionDays: RETENTION_DAYS,
    };
  }),
  createMockRoute("POST", "/api/v1/users/me/suspension/appeal", ({ body }) => {
    const message = typeof (body as { message?: unknown } | null)?.message === "string" ? (body as { message: string }).message.trim() : "";
    if (message.length < 10) throw new ApiError(400, "Explain why you are appealing in at least 10 characters");
    return undefined;
  }),
];
