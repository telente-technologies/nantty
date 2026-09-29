import type { TemplateVariable } from "@/types/notificationTemplate.type";

const templateVariablePattern = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

export function extractTemplateVariableNames(text: string): string[] {
  return [...new Set([...text.matchAll(templateVariablePattern)].map((match) => match[1] ?? ""))];
}

export function findUnknownTemplateVariableNames(text: string, allowedVariables: readonly TemplateVariable[]): string[] {
  const allowedNames = new Set(allowedVariables.map((variable) => variable.name));
  return extractTemplateVariableNames(text).filter((name) => !allowedNames.has(name));
}

export function hasUnbalancedTemplateBraces(text: string): boolean {
  const withoutValidVariables = text.replace(templateVariablePattern, "");
  return withoutValidVariables.includes("{{") || withoutValidVariables.includes("}}");
}

export function renderTemplateWithSampleValues(text: string, variables: readonly TemplateVariable[]): string {
  const sampleValues = new Map(variables.map((variable) => [variable.name, variable.sampleValue]));
  return text.replace(templateVariablePattern, (whole, name: string) => sampleValues.get(name) ?? whole);
}

export function readCharacterLimitForChannel(channel: string): number {
  if (channel === "SMS") return 320;
  if (channel === "PUSH") return 240;
  if (channel === "IN_APP") return 600;
  return 8000;
}
