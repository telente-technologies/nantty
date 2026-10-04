import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { PagedList } from "@/types/api.type";
import type { LiveIncidentAction, LiveIncidentDetail, LiveIncidentSummary } from "@/types/liveIncident.type";

export interface LiveIncidentQueueFilters {
  readonly status?: string;
  readonly priority?: string;
  readonly search?: string;
  readonly page?: number;
}

export function fetchLiveIncidents(filters: LiveIncidentQueueFilters, signal?: AbortSignal): Promise<PagedList<LiveIncidentSummary>> {
  return sendAdminApiRequest("/admin/live-incidents", { query: { ...filters }, signal });
}

export function fetchLiveIncidentDetail(incidentId: string, signal?: AbortSignal): Promise<LiveIncidentDetail> {
  return sendAdminApiRequest(`/admin/live-incidents/${encodeURIComponent(incidentId)}`, { signal });
}

export function decideLiveIncident(incidentId: string, action: Exclude<LiveIncidentAction, "end_and_suspend">, reason: string): Promise<LiveIncidentDetail> {
  return sendAdminApiRequest(`/admin/live-incidents/${encodeURIComponent(incidentId)}/actions`, { method: "POST", body: { action, reason } });
}

export function endLiveAndSuspendHost(incidentId: string, durationDays: number, reason: string): Promise<LiveIncidentDetail> {
  return sendAdminApiRequest(`/admin/live-incidents/${encodeURIComponent(incidentId)}/end-and-suspend`, { method: "POST", body: { durationDays, reason } });
}
