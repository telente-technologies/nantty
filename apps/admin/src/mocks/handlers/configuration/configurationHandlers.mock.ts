import { readMockAreaStore } from "@/mocks/mockDatabase.mock";
import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import { automationCatalog, automationSampleEvents, buildInitialAutomationExecutions } from "@/mocks/seed/configurationAutomation.mock";
import { readTemplateVariablesForEvent } from "@/mocks/seed/configurationTemplates.mock";

import { automationRulesDefinition, configurationDocumentsDefinition, experimentsDefinition, featureFlagsDefinition, notificationTemplatesDefinition } from "./configurationCollectionDefinitions.mock";
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

function registerNotificationTemplateReferenceMockHandlers(): void {
  registerMockRoute("GET", "/admin/notification-templates/events/:event/variables", (request) => {
    requireMockPermission(request, "templates:manage", "config:read");
    return respondWithJson(200, { items: readTemplateVariablesForEvent(request.params.event ?? "") });
  });
}

export function registerConfigurationMockHandlers(): void {
  registerAutomationReferenceMockHandlers();
  registerNotificationTemplateReferenceMockHandlers();
  registerVersionedCollectionRoutes(configurationDocumentsDefinition);
  registerVersionedCollectionRoutes(featureFlagsDefinition);
  registerVersionedCollectionRoutes(experimentsDefinition);
  registerVersionedCollectionRoutes(automationRulesDefinition);
  registerVersionedCollectionRoutes(notificationTemplatesDefinition);
}
