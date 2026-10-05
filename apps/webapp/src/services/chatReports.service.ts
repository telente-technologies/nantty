import type { ChatReportInput, SubmittedChatReport } from "@/types";
import type { ContentReport } from "@/types/support.type";

import { createIdempotencyKey, sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export const chatReportsService = {
  submitChatReport: (input: ChatReportInput, idempotencyKey: string = createIdempotencyKey("chatreport")) =>
    sendRequestToWebappServer<SubmittedChatReport>("/api/v1/reports", { method: "POST", body: input, idempotencyKey }),
  listMyReports: () => sendListRequestToWebappServer<ContentReport>("/api/v1/reports/me"),
  blockConversationPeer: (conversationId: string) =>
    sendRequestToWebappServer<void>(`/api/v1/conversations/${conversationId}/block`, { method: "POST" }),
  restrictConversationPeer: (conversationId: string) =>
    sendRequestToWebappServer<void>(`/api/v1/conversations/${conversationId}/restrict`, { method: "POST" }),
};
