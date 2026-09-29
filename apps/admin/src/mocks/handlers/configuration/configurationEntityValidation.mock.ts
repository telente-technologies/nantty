import { automationCatalog } from "@/mocks/seed/configurationAutomation.mock";
import { readTemplateVariablesForEvent } from "@/mocks/seed/configurationTemplates.mock";
import { failValidation } from "@/mocks/mockResponses.mock";
import type { AutomationRuleContent } from "@/types/automation.type";
import type { ClientPlatform, ExperimentContent, FeatureFlagContent } from "@/types/featureFlags.type";
import type { NotificationTemplateContent } from "@/types/notificationTemplate.type";
import { findUnknownTemplateVariableNames, hasUnbalancedTemplateBraces, readCharacterLimitForChannel } from "@/utils/templateVariables.util";

import { readArrayAtPath, readBooleanValue, readCountryCodeList, readEnumFromObject, readIntegerBetween, readNullableTextValue, readObjectAtPath, readTextList, readTextValue } from "./configurationFieldReaders.mock";

export const configurationRecordIdPattern = /^[a-z][a-z0-9_.-]{2,63}$/;

export function validateFeatureFlagContent(rawContent: unknown): FeatureFlagContent {
  const content = readObjectAtPath(rawContent, "content");
  const targeting = readObjectAtPath(content.targeting, "content.targeting");
  const minimumAppVersion = readNullableTextValue(targeting, "minimumAppVersion", "content.targeting", 20);
  if (minimumAppVersion && !/^\d+\.\d+\.\d+$/.test(minimumAppVersion)) failValidation("content.targeting.minimumAppVersion", "Use a version like 3.4.0.");
  const platforms = readTextList(targeting, "platforms", "content.targeting", 3, 10, /^(IOS|ANDROID|WEB)$/) as ClientPlatform[];
  if (platforms.length === 0) failValidation("content.targeting.platforms", "Choose at least one platform.");
  return {
    description: readTextValue(content, "description", "content", 300, 5),
    owner: readTextValue(content, "owner", "content", 60, 2),
    isEnabled: readBooleanValue(content, "isEnabled", "content"),
    isKillSwitch: readBooleanValue(content, "isKillSwitch", "content"),
    rolloutPercent: readIntegerBetween(content, "rolloutPercent", "content", 0, 100),
    targeting: { countries: readCountryCodeList(targeting, "countries", "content.targeting"), platforms, minimumAppVersion },
  };
}

export function validateExperimentContent(rawContent: unknown, currentContent: ExperimentContent | null): ExperimentContent {
  const content = readObjectAtPath(rawContent, "content");
  const status = readEnumFromObject(content, "status", "content", ["DRAFT", "RUNNING", "STOPPED"] as const);
  if (currentContent?.status === "STOPPED" && status !== "STOPPED") failValidation("content.status", "A stopped experiment cannot restart. Create a new experiment.");
  const variants = readArrayAtPath(content.variants, "content.variants", 6).map((rawVariant, index) => {
    const variant = readObjectAtPath(rawVariant, `content.variants.${index}`);
    return { key: readTextValue(variant, "key", `content.variants.${index}`, 40, 2), description: readTextValue(variant, "description", `content.variants.${index}`, 160, 2), weightPercent: readIntegerBetween(variant, "weightPercent", `content.variants.${index}`, 0, 100) };
  });
  if (variants.length < 2) failValidation("content.variants", "An experiment needs at least two variants.");
  if (variants.reduce((total, variant) => total + variant.weightPercent, 0) !== 100) failValidation("content.variants", "Variant weights must add up to 100%.");
  if (new Set(variants.map((variant) => variant.key)).size !== variants.length) failValidation("content.variants", "Variant keys must be unique.");
  if (currentContent?.status === "RUNNING" && JSON.stringify(currentContent.variants) !== JSON.stringify(variants) && status === "RUNNING") failValidation("content.variants", "Stop the experiment before changing variants or weights.");
  const startedAt = status === "RUNNING" ? (currentContent?.startedAt ?? new Date().toISOString()) : (currentContent?.startedAt ?? null);
  return { name: readTextValue(content, "name", "content", 80, 3), hypothesis: readTextValue(content, "hypothesis", "content", 400, 5), primaryMetric: readTextValue(content, "primaryMetric", "content", 60, 3), status, variants, startedAt };
}

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

export function validateNotificationTemplateContent(rawContent: unknown, recordId: string, currentContent: NotificationTemplateContent | null): NotificationTemplateContent {
  const content = readObjectAtPath(rawContent, "content");
  const event = currentContent?.event ?? readTextValue(content, "event", "content", 60, 3);
  const channel = currentContent?.channel ?? readEnumFromObject(content, "channel", "content", ["PUSH", "EMAIL", "SMS", "IN_APP"] as const);
  const locale = currentContent?.locale ?? readEnumFromObject(content, "locale", "content", ["en", "fr", "pcm"] as const);
  if (!currentContent && recordId !== `${event}.${channel.toLowerCase()}.${locale}`) failValidation("id", "The template ID must be event.channel.locale.");
  const variables = readTemplateVariablesForEvent(event);
  if (variables.length === 0) failValidation("content.event", "No notification event with that name exists.");
  const subject = channel === "EMAIL" ? readTextValue(content, "subject", "content", 150, 3) : null;
  const body = readTextValue(content, "body", "content", readCharacterLimitForChannel(channel), 3);
  for (const [fieldName, text] of [["subject", subject ?? ""], ["body", body]] as const) {
    if (hasUnbalancedTemplateBraces(text)) failValidation(`content.${fieldName}`, "A {{ or }} is not closed properly.");
    const unknownNames = findUnknownTemplateVariableNames(text, variables);
    if (unknownNames.length > 0) failValidation(`content.${fieldName}`, `Unknown variables: ${unknownNames.map((name) => `{{${name}}}`).join(", ")}.`);
  }
  return { event, channel, locale, isEnabled: readBooleanValue(content, "isEnabled", "content"), subject, body, variables };
}
