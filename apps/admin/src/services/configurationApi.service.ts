import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { AutomationCatalog, AutomationExecution, AutomationRuleContent, AutomationSampleEvent } from "@/types/automation.type";
import type { ConfigurationDocumentContentByKey, ConfigurationDocumentKey, VersionedRecord } from "@/types/platformConfiguration.type";

export interface VersionedCollectionEndpoint<Content> {
  readonly basePath: string;
  readonly contentMarker?: Content;
}

export const configurationDocumentEndpoint = <Key extends ConfigurationDocumentKey>(): VersionedCollectionEndpoint<ConfigurationDocumentContentByKey[Key]> => ({ basePath: "/admin/config" });
export const automationRulesEndpoint: VersionedCollectionEndpoint<AutomationRuleContent> = { basePath: "/admin/automation/rules" };

function buildRecordPath(endpoint: VersionedCollectionEndpoint<unknown>, recordId: string): string {
  return `${endpoint.basePath}/${encodeURIComponent(recordId)}`;
}

export function fetchVersionedRecords<Content>(endpoint: VersionedCollectionEndpoint<Content>, signal?: AbortSignal): Promise<{ items: VersionedRecord<Content>[] }> {
  return sendAdminApiRequest(endpoint.basePath, { signal });
}

export function fetchVersionedRecord<Content>(endpoint: VersionedCollectionEndpoint<Content>, recordId: string, signal?: AbortSignal): Promise<VersionedRecord<Content>> {
  return sendAdminApiRequest(buildRecordPath(endpoint, recordId), { signal });
}

export function fetchVersionHistory<Content>(endpoint: VersionedCollectionEndpoint<Content>, recordId: string, signal?: AbortSignal): Promise<{ items: VersionedRecord<Content>[] }> {
  return sendAdminApiRequest(`${buildRecordPath(endpoint, recordId)}/versions`, { signal });
}

export function saveVersionedRecord<Content>(endpoint: VersionedCollectionEndpoint<Content>, recordId: string, input: { expectedVersion: number; reason: string; content: Content }): Promise<VersionedRecord<Content>> {
  return sendAdminApiRequest(buildRecordPath(endpoint, recordId), { method: "PUT", body: input });
}

export function restoreRecordVersion<Content>(endpoint: VersionedCollectionEndpoint<Content>, recordId: string, version: number, input: { expectedVersion: number; reason: string }): Promise<VersionedRecord<Content>> {
  return sendAdminApiRequest(`${buildRecordPath(endpoint, recordId)}/versions/${version}/restore`, { method: "POST", body: input });
}

export function archiveVersionedRecord<Content>(endpoint: VersionedCollectionEndpoint<Content>, recordId: string, input: { expectedVersion: number; reason: string }): Promise<VersionedRecord<Content>> {
  return sendAdminApiRequest(buildRecordPath(endpoint, recordId), { method: "DELETE", body: input });
}

export function fetchAutomationCatalog(signal?: AbortSignal): Promise<AutomationCatalog> {
  return sendAdminApiRequest("/admin/automation/catalog", { signal });
}

export function fetchAutomationSampleEvents(signal?: AbortSignal): Promise<{ items: AutomationSampleEvent[] }> {
  return sendAdminApiRequest("/admin/automation/sample-events", { signal });
}

export function fetchAutomationExecutions(ruleId: string | null, signal?: AbortSignal): Promise<{ items: AutomationExecution[] }> {
  return sendAdminApiRequest("/admin/automation/executions", { query: { ruleId }, signal });
}

export interface RetentionPolicyRecord {
  readonly category: string;
  readonly action: "delete" | "anonymize" | "retain";
  readonly retentionDays: number | null;
  readonly needsLegalReview: boolean;
  readonly version: number;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export function fetchRetentionPolicies(signal?: AbortSignal): Promise<{ data: RetentionPolicyRecord[]; nextCursor: string | null }> {
  return sendAdminApiRequest("/admin/retention-policies", { signal });
}

export function updateRetentionPolicy(
  category: string,
  input: { action: "delete" | "anonymize" | "retain"; retentionDays: number | null; needsLegalReview: boolean; expectedVersion: number; reason: string },
): Promise<RetentionPolicyRecord> {
  return sendAdminApiRequest(`/admin/retention-policies/${encodeURIComponent(category)}`, { method: "PUT", body: input });
}
