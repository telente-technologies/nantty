import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { createMockId, failNotFound, failValidation, readIsoNow, readJsonObjectBody, readRequiredTrimmedString, respondWithJson, respondWithNoContent } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { MockSupportMacroRecord } from "@/mocks/seed/supportSeed.mock";
import type { SupportTicketCategory } from "@/types/support.type";

import { readSupportMockStore } from "./contentStores.mock";

const macroCategories: readonly SupportTicketCategory[] = ["ORDER", "PAYMENT", "ACCOUNT", "SELLER", "VERIFICATION", "CREATOR", "LIVE", "ADS", "SAFETY", "DEVELOPER", "SANDBOX", "OTHER"];
const allowedMacroVariables = ["user.displayName", "user.username", "ticket.id", "agent.name"];

function readMacroFields(body: Record<string, unknown>) {
  const title = readRequiredTrimmedString(body, "title", 80, 3);
  const text = readRequiredTrimmedString(body, "body", 3000, 10);
  const unknownVariables = [...text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((match) => match[1] ?? "").filter((variable) => !allowedMacroVariables.includes(variable));
  if (unknownVariables.length > 0) failValidation("body", `Unknown variables: ${unknownVariables.join(", ")}. Use ${allowedMacroVariables.map((variable) => `{{${variable}}}`).join(", ")}.`);
  const category = body.category === null || body.category === undefined || body.category === "" ? null : (body.category as SupportTicketCategory);
  if (category !== null && !macroCategories.includes(category)) failValidation("category", "Choose a ticket category or none.");
  return { title, body: text, category };
}

function findMacroOrFail(macroId: string | undefined): MockSupportMacroRecord {
  const macro = readSupportMockStore().macros.find((candidate) => candidate.id === macroId);
  if (!macro) failNotFound("Macro");
  return macro;
}

export function registerSupportMacroMockHandlers(): void {
  registerMockRoute("GET", "/admin/support/macros", (request) => {
    requireMockPermission(request, "support:tickets", "support:assign");
    return respondWithJson(200, { items: readSupportMockStore().macros, variables: allowedMacroVariables });
  });

  registerMockRoute("POST", "/admin/support/macros", (request) => {
    const principal = requireMockPermission(request, "support:assign");
    const macro: MockSupportMacroRecord = { id: createMockId("mac"), ...readMacroFields(readJsonObjectBody(request)), updatedAt: readIsoNow(), updatedByName: principal.name };
    readSupportMockStore().macros.push(macro);
    recordMockAuditEntry(request, { action: "support.macro_created", area: "support", target: { type: "supportMacro", id: macro.id, label: macro.title }, before: null, after: macro });
    return respondWithJson(201, macro);
  });

  registerMockRoute("PUT", "/admin/support/macros/:macroId", (request) => {
    const principal = requireMockPermission(request, "support:assign");
    const before = findMacroOrFail(request.params.macroId);
    const updated: MockSupportMacroRecord = { ...before, ...readMacroFields(readJsonObjectBody(request)), updatedAt: readIsoNow(), updatedByName: principal.name };
    const store = readSupportMockStore();
    store.macros = store.macros.map((macro) => (macro.id === updated.id ? updated : macro));
    recordMockAuditEntry(request, { action: "support.macro_updated", area: "support", target: { type: "supportMacro", id: updated.id, label: updated.title }, before, after: updated });
    return respondWithJson(200, updated);
  });

  registerMockRoute("DELETE", "/admin/support/macros/:macroId", (request) => {
    requireMockPermission(request, "support:assign");
    const macro = findMacroOrFail(request.params.macroId);
    const store = readSupportMockStore();
    store.macros = store.macros.filter((candidate) => candidate.id !== macro.id);
    recordMockAuditEntry(request, { action: "support.macro_deleted", area: "support", target: { type: "supportMacro", id: macro.id, label: macro.title }, before: macro, after: null });
    return respondWithNoContent();
  });
}
