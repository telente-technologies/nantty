import type { ChatReportInput, SubmittedChatReport } from "@/types";

import { api, generateIdempotencyKey } from "../core/apiClient.service";

export const chatReportsService = {
  submitChatReport: (input: ChatReportInput, idempotencyKey: string = generateIdempotencyKey()) =>
    api.post<SubmittedChatReport>("/api/v1/reports", input, { idempotencyKey }),
  restrictConversationPeer: (conversationId: string) => api.post<void>(`/api/v1/conversations/${conversationId}/restrict`),
};
