import { legalDocumentDefinitions, materialChangeNoticeDays } from "@/constants/legalDocuments.constant";
import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { failConflict, failValidation, readIsoNow, readJsonObjectBody, readRequiredReason, readRequiredTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { MutableLegalVersion } from "@/mocks/seed/legalDocuments.mock";
import type { LegalDocumentKey } from "@/types/legal.type";

import { queueLegalNotice, shouldNotifyUsersAboutPublish } from "./legalNotices.mock";
import { findVersionOrFail, listVersionsOfDocument, presentDocumentSummary, readDocumentDefinitionOrFail, readLegalStore, thirtyDaysInMilliseconds } from "./legalStore.mock";

const shortNoticeThresholdMilliseconds = thirtyDaysInMilliseconds - 86_400_000;

function readVersionFields(body: Record<string, unknown>) {
  const bodyMarkdown = readRequiredTrimmedString(body, "bodyMarkdown", 120_000, 20);
  const changeSummary = readRequiredTrimmedString(body, "changeSummary", 1000, 10);
  const isMaterialChange = body.isMaterialChange === true;
  const effectiveAtText = typeof body.effectiveAt === "string" ? body.effectiveAt : "";
  const effectiveAtEpochMs = Date.parse(effectiveAtText);
  if (Number.isNaN(effectiveAtEpochMs)) failValidation("effectiveAt", "Choose a valid effective date.");
  return { bodyMarkdown, changeSummary, isMaterialChange, effectiveAt: new Date(effectiveAtEpochMs).toISOString() };
}

function auditVersion(request: MockRequest, version: MutableLegalVersion, action: string, reason: string | null, before: unknown, after: unknown) {
  const title = readDocumentDefinitionOrFail(version.documentKey).title;
  recordMockAuditEntry(request, { action: `legal_version.${action}`, area: "legal", target: { type: "legalVersion", id: version.id, label: `${title} v${version.versionNumber}` }, reason, before, after });
}

function failIfOpenVersionExists(documentKey: LegalDocumentKey): void {
  if (listVersionsOfDocument(documentKey).some((version) => version.status === "DRAFT" || version.status === "IN_REVIEW")) failConflict("OPEN_VERSION_EXISTS", "Finish or return the open version before starting another.");
}

function addVersion(documentKey: LegalDocumentKey, createdByName: string, fields: ReturnType<typeof readVersionFields>, extra: Partial<MutableLegalVersion> = {}): MutableLegalVersion {
  const nextNumber = Math.max(0, ...listVersionsOfDocument(documentKey).map((version) => version.versionNumber)) + 1;
  const created: MutableLegalVersion = { id: `lgv_${documentKey}_${nextNumber}`, documentKey, versionNumber: nextNumber, status: "DRAFT", ...fields, isFlaggedForLegalReview: fields.isMaterialChange, createdByName, createdAt: readIsoNow(), submittedByName: null, submittedAt: null, publishedByName: null, publishedAt: null, returnedReason: null, rolledBackFromVersionNumber: null, noticeId: null, ...extra };
  readLegalStore().versions.push(created);
  return created;
}

function readDocumentKeyOrFail(request: MockRequest): LegalDocumentKey {
  return readDocumentDefinitionOrFail(request.params.documentKey ?? "").key;
}

export function registerLegalDocumentMockHandlers(): void {
  registerMockRoute("GET", "/admin/legal/documents", (request) => {
    requireMockPermission(request, "legal.documents.view");
    return respondWithJson(200, { items: legalDocumentDefinitions.map((definition) => presentDocumentSummary(definition.key)) });
  });

  registerMockRoute("GET", "/admin/legal/documents/:documentKey", (request) => {
    requireMockPermission(request, "legal.documents.view");
    const documentKey = readDocumentKeyOrFail(request);
    return respondWithJson(200, { document: presentDocumentSummary(documentKey), versions: listVersionsOfDocument(documentKey) });
  });

  registerMockRoute("POST", "/admin/legal/documents/:documentKey/versions", (request) => {
    const principal = requireMockPermission(request, "legal.documents.edit");
    const documentKey = readDocumentKeyOrFail(request);
    failIfOpenVersionExists(documentKey);
    const created = addVersion(documentKey, principal.name, readVersionFields(readJsonObjectBody(request)));
    auditVersion(request, created, "created", null, null, { versionNumber: created.versionNumber, isMaterialChange: created.isMaterialChange, effectiveAt: created.effectiveAt });
    return respondWithJson(201, created);
  });

  registerMockRoute("POST", "/admin/legal/documents/:documentKey/rollback", (request) => {
    const principal = requireMockPermission(request, "legal.documents.edit");
    const documentKey = readDocumentKeyOrFail(request);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    const source = findVersionOrFail(typeof body.fromVersionId === "string" ? body.fromVersionId : "");
    if (source.documentKey !== documentKey) failValidation("fromVersionId", "That version belongs to another document.");
    failIfOpenVersionExists(documentKey);
    const effectiveAt = new Date(Date.now() + materialChangeNoticeDays * 86_400_000).toISOString();
    const created = addVersion(documentKey, principal.name, { bodyMarkdown: source.bodyMarkdown, changeSummary: `Restores the wording of version ${source.versionNumber}. ${reason}`, isMaterialChange: true, effectiveAt }, { rolledBackFromVersionNumber: source.versionNumber });
    auditVersion(request, created, "rolled_back", reason, { restoredFromVersion: source.versionNumber }, { newVersionNumber: created.versionNumber, status: "DRAFT" });
    return respondWithJson(201, created);
  });

  registerMockRoute("GET", "/admin/legal/versions/:versionId", (request) => {
    requireMockPermission(request, "legal.documents.view");
    return respondWithJson(200, findVersionOrFail(request.params.versionId ?? ""));
  });

  registerMockRoute("PUT", "/admin/legal/versions/:versionId", (request) => {
    requireMockPermission(request, "legal.documents.edit");
    const version = findVersionOrFail(request.params.versionId ?? "");
    if (version.status !== "DRAFT") failConflict("NOT_DRAFT", "Only a draft can be edited. Return it to draft first.");
    const fields = readVersionFields(readJsonObjectBody(request));
    const before = { changeSummary: version.changeSummary, effectiveAt: version.effectiveAt, isMaterialChange: version.isMaterialChange, bodyLength: version.bodyMarkdown.length };
    Object.assign(version, fields, { isFlaggedForLegalReview: fields.isMaterialChange });
    auditVersion(request, version, "updated", null, before, { changeSummary: version.changeSummary, effectiveAt: version.effectiveAt, isMaterialChange: version.isMaterialChange, bodyLength: version.bodyMarkdown.length });
    return respondWithJson(200, version);
  });

  registerMockRoute("POST", "/admin/legal/versions/:versionId/submit", (request) => {
    const principal = requireMockPermission(request, "legal.documents.edit");
    const version = findVersionOrFail(request.params.versionId ?? "");
    if (version.status !== "DRAFT") failConflict("NOT_DRAFT", "Only a draft can be submitted for review.");
    Object.assign(version, { status: "IN_REVIEW", submittedByName: principal.name, submittedAt: readIsoNow(), returnedReason: null });
    auditVersion(request, version, "submitted_for_review", null, { status: "DRAFT" }, { status: "IN_REVIEW" });
    return respondWithJson(200, version);
  });

  registerMockRoute("POST", "/admin/legal/versions/:versionId/return", (request) => {
    requireMockPermission(request, "legal.documents.publish");
    const reason = readRequiredReason(readJsonObjectBody(request));
    const version = findVersionOrFail(request.params.versionId ?? "");
    if (version.status !== "IN_REVIEW") failConflict("NOT_IN_REVIEW", "Only a version in review can be returned.");
    Object.assign(version, { status: "DRAFT", returnedReason: reason, submittedByName: null, submittedAt: null });
    auditVersion(request, version, "returned_to_draft", reason, { status: "IN_REVIEW" }, { status: "DRAFT" });
    return respondWithJson(200, version);
  });

  registerMockRoute("POST", "/admin/legal/versions/:versionId/publish", (request) => {
    const principal = requireMockPermission(request, "legal.documents.publish");
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    const version = findVersionOrFail(request.params.versionId ?? "");
    if (version.status !== "IN_REVIEW") failConflict("NOT_IN_REVIEW", "Only a version in review can be published.");
    if (version.submittedByName === principal.name || version.createdByName === principal.name) failConflict("SAME_ADMIN", "A second Legal admin or a superadmin must publish this version.");
    const isShortNotice = version.isMaterialChange && Date.parse(version.effectiveAt) < Date.now() + shortNoticeThresholdMilliseconds;
    if (isShortNotice && body.acknowledgeShortNotice !== true) failConflict("SHORT_NOTICE", `A material change normally gives users ${materialChangeNoticeDays} days. Confirm the shorter notice has been cleared by legal.`);
    const before = { status: version.status };
    for (const sibling of listVersionsOfDocument(version.documentKey)) if (sibling.status === "PUBLISHED") sibling.status = "SUPERSEDED";
    Object.assign(version, { status: "PUBLISHED", publishedByName: principal.name, publishedAt: readIsoNow() });
    const notice = shouldNotifyUsersAboutPublish(version) ? queueLegalNotice(request, version, principal.name, reason) : null;
    auditVersion(request, version, "published", reason, before, { status: "PUBLISHED", makers: [version.submittedByName, principal.name], effectiveAt: version.effectiveAt, isMaterialChange: version.isMaterialChange, shortNoticeAcknowledged: isShortNotice, noticeId: notice?.id ?? null });
    return respondWithJson(200, { version, noticeId: notice?.id ?? null });
  });
}
