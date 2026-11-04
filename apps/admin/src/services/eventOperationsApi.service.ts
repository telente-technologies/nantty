import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { EventOperationsSnapshot } from "@/types/eventOperations.type";

export function fetchEventQueues(signal?: AbortSignal): Promise<EventOperationsSnapshot> {
  return sendAdminApiRequest("/admin/event-operations/queues", { signal });
}
