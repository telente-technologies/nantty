import { automationCatalog } from "@/mocks/seed/configurationAutomation.mock";
import { failValidation } from "@/mocks/mockResponses.mock";
import type { AutomationRuleContent } from "@/types/automation.type";

import { readArrayAtPath, readBooleanValue, readEnumFromObject, readObjectAtPath, readTextValue } from "./configurationFieldReaders.mock";

export function validateAutomationRuleContent(rawContent: unknown): AutomationRuleContent {
  const content = readObjectAtPath(rawContent, "content");
  const event = readEnumFromObject(content, "event", "content", automationCatalog.events.map((definition) => definition.key));
  const eventDefinition = automationCatalog.events.find((definition) => definition.key === event)!;
  const conditions = readArrayAtPath(content.conditions, "content.conditions", 10).map((rawCondition, index) => {
    const condition = readObjectAtPath(rawCondition, `content.conditions.${index}`);
    return {
      field: readEnumFromObject(condition, "field", `content.conditions.${index}`, eventDefinition.fields.map((field) => field.key)),
      operator: readEnumFromObject(condition, "operator", `content.conditions.${index}`, automationCatalog.operators.map((operator) => operator.key)),
      value: readTextValue(condition, "value", `content.conditions.${index}`, 200, 1),
    };
  });
  const actions = readArrayAtPath(content.actions, "content.actions", 6).map((rawAction, index) => {
    const action = readObjectAtPath(rawAction, `content.actions.${index}`);
    const type = readEnumFromObject(action, "type", `content.actions.${index}`, automationCatalog.actions.map((definition) => definition.type));
    const definition = automationCatalog.actions.find((candidate) => candidate.type === type)!;
    const rawParameters = readObjectAtPath(action.parameters ?? {}, `content.actions.${index}.parameters`);
    const parameters = Object.fromEntries(definition.parameters.map((parameter) => [parameter.key, readTextValue(rawParameters, parameter.key, `content.actions.${index}.parameters`, 120, 1)]));
    return { type, parameters };
  });
  if (actions.length === 0) failValidation("content.actions", "Add at least one action.");
  return {
    name: readTextValue(content, "name", "content", 80, 3),
    description: readTextValue(content, "description", "content", 300, 0),
    isEnabled: readBooleanValue(content, "isEnabled", "content"),
    event,
    conditionMatch: readEnumFromObject(content, "conditionMatch", "content", ["ALL", "ANY"] as const),
    conditions,
    actions,
  };
}
