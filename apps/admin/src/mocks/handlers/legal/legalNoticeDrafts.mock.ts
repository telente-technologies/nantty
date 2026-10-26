import { materialChangeNoticeDays } from "@/constants/legalDocuments.constant";
import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { failValidation, readIsoNow, readJsonObjectBody, readOptionalTrimmedString, readRequiredTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { MutableLegalVersion } from "@/mocks/seed/legalDocuments.mock";
import type { LegalNoticeDraft } from "@/types/legal.type";
import { buildSideBySideLineDiff } from "@/utils/legalLineDiff.util";

import { findVersionOrFail, listVersionsOfDocument, readDocumentDefinitionOrFail, readLegalStore } from "./legalStore.mock";

const marketingSiteUrl = "https://nantty.com";

function summariseChangedLines(version: MutableLegalVersion): string[] {
  const previous = listVersionsOfDocument(version.documentKey).find((candidate) => candidate.versionNumber < version.versionNumber && (candidate.status === "PUBLISHED" || candidate.status === "SUPERSEDED"));
  if (!previous) return ["First published version."];
  const lines: string[] = [];
  const headingsSeen = new Set<string>();
  let currentHeading = "Introduction";
  for (const row of buildSideBySideLineDiff(previous.bodyMarkdown, version.bodyMarkdown)) {
    const shownText = row.rightText ?? row.leftText ?? "";
    if (row.kind === "same" || row.rightText === null) {
      if (row.kind === "same" && shownText.startsWith("#")) currentHeading = shownText.replace(/^#+\s*/, "");
      if (row.kind === "same" || !shownText.trim()) continue;
    }
    if (shownText.startsWith("#")) currentHeading = shownText.replace(/^#+\s*/, "");
    if (!shownText.trim() || headingsSeen.has(currentHeading)) continue;
    headingsSeen.add(currentHeading);
    const verb = row.kind === "added" ? "Added" : row.kind === "removed" ? "Removed" : "Updated";
    lines.push(`${verb} in "${currentHeading}": ${shownText.replace(/^#+\s*/, "").slice(0, 120)}`);
  }
  return lines.length > 0 ? lines : ["Wording and formatting tidy-ups only."];
}

function buildDefaultDraft(version: MutableLegalVersion): LegalNoticeDraft {
  const definition = readDocumentDefinitionOrFail(version.documentKey);
  return {
    versionId: version.id, documentTitle: definition.title, subject: `We've updated our ${definition.title}`, summaryText: version.changeSummary, whatChanged: summariseChangedLines(version), effectiveAt: version.effectiveAt,
    reacceptNote: version.isMaterialChange ? `This is a material change. Please review and accept it in the app before the effective date to keep using Nantty. You have at least ${materialChangeNoticeDays} days.` : null,
    documentUrl: `${marketingSiteUrl}${definition.publicPath}`, updatedByName: null, updatedAt: null, testSends: [],
  };
}

export function readNoticeDraft(version: MutableLegalVersion): LegalNoticeDraft {
  const drafts = readLegalStore().noticeDrafts;
  const existing = drafts.get(version.id);
  const draft = existing ? { ...existing, effectiveAt: version.effectiveAt } : buildDefaultDraft(version);
  drafts.set(version.id, draft);
  return draft;
}

export function registerLegalNoticeDraftMockHandlers(): void {
  registerMockRoute("GET", "/admin/legal/versions/:versionId/notice-draft", (request) => {
    requireMockPermission(request, "legal.documents.view", "legal.notices.send");
    return respondWithJson(200, readNoticeDraft(findVersionOrFail(request.params.versionId ?? "")));
  });

  registerMockRoute("PUT", "/admin/legal/versions/:versionId/notice-draft", (request) => {
    const principal = requireMockPermission(request, "legal.documents.edit", "legal.notices.send");
    const version = findVersionOrFail(request.params.versionId ?? "");
    const body = readJsonObjectBody(request);
    if (!Array.isArray(body.whatChanged) || body.whatChanged.some((line) => typeof line !== "string")) failValidation("whatChanged", "Send the changes as a list of lines.");
    const whatChanged = (body.whatChanged as string[]).map((line) => line.trim()).filter(Boolean).slice(0, 30);
    const before = readNoticeDraft(version);
    const draft: LegalNoticeDraft = { ...before, subject: readRequiredTrimmedString(body, "subject", 150, 5), summaryText: readRequiredTrimmedString(body, "summaryText", 1500, 10), whatChanged, reacceptNote: readOptionalTrimmedString(body, "reacceptNote", 600), updatedByName: principal.name, updatedAt: readIsoNow() };
    readLegalStore().noticeDrafts.set(version.id, draft);
    recordMockAuditEntry(request, { action: "legal_notice_draft.updated", area: "legal", target: { type: "legalVersion", id: version.id, label: `${draft.documentTitle} v${version.versionNumber}` }, before: { subject: before.subject, whatChangedCount: before.whatChanged.length }, after: { subject: draft.subject, whatChangedCount: whatChanged.length } });
    return respondWithJson(200, draft);
  });

  registerMockRoute("POST", "/admin/legal/versions/:versionId/notice-draft/test-send", (request) => {
    const principal = requireMockPermission(request, "legal.notices.send", "legal.documents.edit");
    const version = findVersionOrFail(request.params.versionId ?? "");
    const draft = readNoticeDraft(version);
    const staff = readMockDatabase().admins.find((admin) => admin.id === principal.adminId);
    const testSend = { sentToEmail: staff?.email ?? "unknown@example.com", sentByName: principal.name, sentAt: readIsoNow() };
    const updated: LegalNoticeDraft = { ...draft, testSends: [testSend, ...draft.testSends].slice(0, 10) };
    readLegalStore().noticeDrafts.set(version.id, updated);
    recordMockAuditEntry(request, { action: "legal_notice_draft.test_sent", area: "legal", target: { type: "legalVersion", id: version.id, label: `${draft.documentTitle} v${version.versionNumber}` }, after: { sentToEmail: testSend.sentToEmail, provider: "AWS_SES" } });
    return respondWithJson(200, updated);
  });
}
