import type { CreatorLiveStatus } from "@/types";

const ACTIVE_LIVE_ID_BY_HOST_USER_ID: Readonly<Record<string, string>> = {
  u_1: "live_owambe_edit",
  u_2: "live_s0",
  u_3: "live_s1",
  u_4: "live_s2",
  u_6: "live_s3",
  u_5: "live_s4",
  u_14: "live_olumide_cuts",
};

const LIVE_STARTED_AT = new Date(Date.now() - 18 * 60 * 1000).toISOString();

export const findActiveLiveForHost = (userId: string): CreatorLiveStatus | null => {
  const liveId = ACTIVE_LIVE_ID_BY_HOST_USER_ID[userId];
  return liveId ? { liveId, startedAt: LIVE_STARTED_AT } : null;
};
