import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { PagedList } from "@/types/api.type";
import type { EmailDraftInput, EmailPreview, EmailSegment, EmailSendRecord, EmailTemplate, FailedEmailDeliveryRecord, LiveChatDetail, LiveChatSummary } from "@/types/supportOutreach.type";

const encode = encodeURIComponent;

export function fetchLiveChats(filters: { status: string; search?: string; page?: number }, signal?: AbortSignal): Promise<PagedList<LiveChatSummary>> {
  return sendAdminApiRequest("/admin/support/chats", { query: { ...filters }, signal });
}

export function fetchLiveChatDetail(chatId: string, signal?: AbortSignal): Promise<LiveChatDetail> {
  return sendAdminApiRequest(`/admin/support/chats/${encode(chatId)}`, { signal });
}

export function claimLiveChat(chatId: string): Promise<LiveChatDetail> {
  return sendAdminApiRequest(`/admin/support/chats/${encode(chatId)}/claim`, { method: "POST", body: {} });
}

export function sendLiveChatMessage(chatId: string, body: string): Promise<LiveChatDetail> {
  return sendAdminApiRequest(`/admin/support/chats/${encode(chatId)}/messages`, { method: "POST", body: { body } });
}

export function endLiveChat(chatId: string): Promise<LiveChatDetail> {
  return sendAdminApiRequest(`/admin/support/chats/${encode(chatId)}/end`, { method: "POST", body: {} });
}

export function fetchEmailTemplates(signal?: AbortSignal): Promise<{ items: EmailTemplate[] }> {
  return sendAdminApiRequest("/admin/support/email/templates", { signal });
}

export function fetchEmailSegments(signal?: AbortSignal): Promise<{ items: EmailSegment[] }> {
  return sendAdminApiRequest("/admin/support/email/segments", { signal });
}

export function fetchEmailSends(signal?: AbortSignal): Promise<{ items: EmailSendRecord[] }> {
  return sendAdminApiRequest("/admin/support/email/sends", { signal });
}

export function fetchFailedEmailDeliveries(signal?: AbortSignal): Promise<{ deliveries: FailedEmailDeliveryRecord[] }> {
  return sendAdminApiRequest("/admin/support/email/deliveries/failed", { signal });
}

export function fetchFailedPushDeliveries(signal?: AbortSignal): Promise<{ deliveries: FailedEmailDeliveryRecord[] }> {
  return sendAdminApiRequest("/admin/support/notifications/push/deliveries/failed", { signal });
}

export function previewSupportEmail(input: EmailDraftInput): Promise<EmailPreview> {
  return sendAdminApiRequest("/admin/support/email/preview", { method: "POST", body: input });
}

export function sendSupportEmail(input: EmailDraftInput & { reason: string }): Promise<EmailSendRecord> {
  return sendAdminApiRequest("/admin/support/email/send", { method: "POST", body: input });
}
