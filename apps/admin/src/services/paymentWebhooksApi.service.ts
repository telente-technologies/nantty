import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { DeadLetteredWebhook, DeadLetteredWebhookList } from "@/types/paymentWebhooks.type";

export function fetchDeadLetteredWebhooks(provider: string | undefined, signal?: AbortSignal): Promise<DeadLetteredWebhookList> {
  return sendAdminApiRequest("/admin/payments/webhooks/dead-letters", { query: { provider, limit: 100 }, signal });
}

export function fetchDeadLetteredWebhook(webhookId: string, signal?: AbortSignal): Promise<DeadLetteredWebhook> {
  return sendAdminApiRequest(`/admin/payments/webhooks/dead-letters/${encodeURIComponent(webhookId)}`, { signal });
}

export function replayDeadLetteredWebhook(webhookId: string, reason: string): Promise<DeadLetteredWebhook> {
  return sendAdminApiRequest(`/admin/payments/webhooks/dead-letters/${encodeURIComponent(webhookId)}/replay`, { method: "POST", body: { reason } });
}
