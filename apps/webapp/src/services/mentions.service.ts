import type { ID, MentionCandidatesResponse, MentionPrivacy, MentionSurface, ResolvedMentionUser, WhoCanMentionMe } from "@/types";

import { sendRequestToWebappServer } from "./clientApi.service";

export const mentionsService = {
  fetchMentionCandidates: (surface: MentionSurface, query: string) =>
    sendRequestToWebappServer<MentionCandidatesResponse>("/api/v1/mentions/candidates", { query: { surface, q: query } }),
  resolveMentionedUsers: (userIds: readonly ID[]) =>
    sendRequestToWebappServer<Record<ID, ResolvedMentionUser>>("/api/v1/mentions/resolve", { method: "POST", body: { userIds } }),
  fetchMyMentionPrivacy: () => sendRequestToWebappServer<MentionPrivacy>("/api/v1/users/me/mention-privacy"),
  updateMyMentionPrivacy: (whoCanMentionMe: WhoCanMentionMe) =>
    sendRequestToWebappServer<MentionPrivacy>("/api/v1/users/me/mention-privacy", { method: "PUT", body: { whoCanMentionMe } }),
};
