import { readMockAreaStore } from "@/mocks/mockDatabase.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import { automationCatalog, automationSampleEvents, buildInitialAutomationExecutions } from "@/mocks/seed/configurationAutomation.mock";
import type { RetentionPolicyRecord } from "@/services/configurationApi.service";

import { automationRulesDefinition, configurationDocumentsDefinition } from "./configurationCollectionDefinitions.mock";
import { registerVersionedCollectionRoutes } from "./versionedCollections.mock";

function registerAutomationReferenceMockHandlers(): void {
  registerMockRoute("GET", "/admin/automation/catalog", (request) => {
    requireMockPermission(request, "automation:manage");
    return respondWithJson(200, automationCatalog);
  });
  registerMockRoute("GET", "/admin/automation/sample-events", (request) => {
    requireMockPermission(request, "automation:manage");
    return respondWithJson(200, { items: automationSampleEvents });
  });
  registerMockRoute("GET", "/admin/automation/executions", (request) => {
    requireMockPermission(request, "automation:manage");
    const executions = readMockAreaStore("configuration:automationExecutions", buildInitialAutomationExecutions);
    const ruleId = request.query.get("ruleId");
    return respondWithJson(200, { items: executions.filter((execution) => !ruleId || execution.ruleId === ruleId) });
  });
}

export function registerConfigurationMockHandlers(): void {
  registerAutomationReferenceMockHandlers();
  registerVersionedCollectionRoutes(configurationDocumentsDefinition);
  registerVersionedCollectionRoutes(automationRulesDefinition);

  const retentionPolicies: RetentionPolicyRecord[] = [
    { category: "profile_and_posts", action: "delete", retentionDays: 30, needsLegalReview: false, version: 1, updatedBy: "system", updatedAt: "2026-10-01T00:00:00Z" },
    { category: "chat_messages_and_reviews", action: "anonymize", retentionDays: 30, needsLegalReview: false, version: 1, updatedBy: "system", updatedAt: "2026-10-01T00:00:00Z" },
    { category: "orders_and_tax_records", action: "retain", retentionDays: 2555, needsLegalReview: true, version: 1, updatedBy: "system", updatedAt: "2026-10-01T00:00:00Z" },
  ];

  registerMockRoute("GET", "/admin/retention-policies", (request) => {
    requireMockPermission(request, "config:read");
    return respondWithJson(200, { data: retentionPolicies, nextCursor: null });
  });

  registerMockRoute("PUT", "/admin/retention-policies/:category", (request) => {
    const principal = requireMockPermission(request, "config:rules");
    requireMockStepUp(request);
    const body = readJsonObjectBody(request) as { action?: RetentionPolicyRecord["action"]; retentionDays?: number | null; needsLegalReview?: boolean; expectedVersion?: number; reason?: string };
    readRequiredReason(body);
    const index = retentionPolicies.findIndex((row) => row.category === request.params.category);
    if (index < 0) throw new MockHttpError(404, "NOT_FOUND", "Retention category not found.");
    const current = retentionPolicies[index]!;
    if (body.expectedVersion !== current.version) throw new MockHttpError(409, "VERSION_CONFLICT", "Retention policy changed since you loaded it.");
    const updated: RetentionPolicyRecord = {
      category: current.category,
      action: body.action ?? current.action,
      retentionDays: body.retentionDays ?? current.retentionDays,
      needsLegalReview: body.needsLegalReview ?? current.needsLegalReview,
      version: current.version + 1,
      updatedBy: principal.adminId,
      updatedAt: new Date().toISOString(),
    };
    retentionPolicies[index] = updated;
    return respondWithJson(200, updated);
  });
}
