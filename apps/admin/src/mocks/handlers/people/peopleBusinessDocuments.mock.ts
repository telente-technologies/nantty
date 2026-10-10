import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { readMockAreaStore } from "@/mocks/mockDatabase.mock";
import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { MockHttpError, failNotFound, matchesSearchText, paginateByCursor, readIsoNow, readIsoTimeOffset, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockQueueCounter } from "@/mocks/mockQueueCounters.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { presentPlatformUserSummary } from "@/mocks/seed/demoPlatformUsers.mock";
import { buildDemoBusinessSubmissions, type MockBusinessSubmissionRecord } from "@/mocks/seed/businessDocuments.mock";
import type { BusinessDocumentStatus, BusinessDocumentSubmission } from "@/types/businessDocuments.type";

import { asMutablePlatformUser, findPlatformUserForPeopleOrFail } from "./peopleStore.mock";

function readSubmissions(): MockBusinessSubmissionRecord[] {
  return readMockAreaStore("people:businessDocuments", buildDemoBusinessSubmissions);
}

function readOverallStatus(record: MockBusinessSubmissionRecord): BusinessDocumentStatus {
  if (record.documents.some((item) => item.status === "REJECTED")) return "REJECTED";
  return record.documents.every((item) => item.status === "APPROVED") ? "APPROVED" : "PENDING";
}

function presentSubmission(record: MockBusinessSubmissionRecord): BusinessDocumentSubmission {
  const overallStatus = readOverallStatus(record);
  const goldCheckmark = record.goldGranted ? "GRANTED" : overallStatus === "APPROVED" ? "WAITING_FOR_PLAN" : "NOT_YET";
  return { id: record.id, user: presentPlatformUserSummary(findPlatformUserForPeopleOrFail(record.userId)), storeName: record.storeName, plan: record.plan, overallStatus, submittedAt: record.submittedAt, documents: record.documents, goldCheckmark };
}

function grantGoldIfEligible(record: MockBusinessSubmissionRecord): boolean {
  if (record.goldGranted || readOverallStatus(record) !== "APPROVED" || record.plan === "FREE") return false;
  const user = asMutablePlatformUser(findPlatformUserForPeopleOrFail(record.userId));
  user.verification = { color: "GOLD", tier: record.plan === "BUSINESS" ? "BUSINESS" : "PRO", status: "VERIFIED", badgeVisible: true };
  user.isSeller = true;
  record.goldGranted = true;
  return true;
}

function reviewDocument(request: MockRequest, decision: "APPROVED" | "REJECTED") {
  const principal = requireMockPermission(request, "verification:review");
  const record = readSubmissions().find((candidate) => candidate.id === request.params.submissionId);
  if (!record) failNotFound("Business documents submission");
  const item = record.documents.find((candidate) => candidate.id === request.params.documentId);
  if (!item) failNotFound("Document");
  if (item.status !== "PENDING") throw new MockHttpError(409, "ALREADY_REVIEWED", "This document was already reviewed. Reload to see the outcome.");
  const reason = readRequiredReason(readJsonObjectBody(request));
  const index = record.documents.indexOf(item);
  const reviewed = { ...item, status: decision, rejectionReason: decision === "REJECTED" ? reason : null, reviewedByName: principal.name, reviewedAt: readIsoNow() };
  record.documents[index] = reviewed;
  const goldGranted = grantGoldIfEligible(record);
  const user = findPlatformUserForPeopleOrFail(record.userId);
  recordMockAuditEntry(request, { action: `business_document.${decision.toLowerCase()}`, area: "verification", target: { type: "businessDocuments", id: record.id, label: `${record.storeName} · ${item.kind}` }, reason, before: { status: item.status }, after: { status: decision, overallStatus: readOverallStatus(record), goldGranted, verification: user.verification } });
  return respondWithJson(200, presentSubmission(record));
}

export function countPendingBusinessDocuments() {
  const pending = readSubmissions().filter((record) => readOverallStatus(record) === "PENDING");
  return { count: pending.length, oldestAt: pending.map((record) => record.submittedAt).sort()[0] ?? null };
}

export function registerPeopleBusinessDocumentMockHandlers(): void {
  registerMockQueueCounter({ key: "businessDocuments", label: "Business documents", href: "/verification/business-documents", readCount: countPendingBusinessDocuments });

  registerMockRoute("GET", "/admin/business-documents", (request) => {
    requireMockPermission(request, "verification:review");
    const status = request.query.get("status") ?? "PENDING";
    const search = request.query.get("search");
    const items = readSubmissions().map(presentSubmission).filter((item) => (status === "ALL" || item.overallStatus === status) && matchesSearchText(search, item.storeName, item.user.username, item.user.displayName, item.id)).sort((first, second) => first.submittedAt.localeCompare(second.submittedAt));
    return respondWithJson(200, paginateByCursor(items, request));
  });

  registerMockRoute("GET", "/admin/business-documents/:submissionId/documents/:documentId/access", (request) => {
    const principal = requireMockPermission(request, "verification:documents");
    const record = readSubmissions().find((candidate) => candidate.id === request.params.submissionId);
    const item = record?.documents.find((candidate) => candidate.id === request.params.documentId);
    if (!record || !item) failNotFound("Document");
    recordMockAuditEntry(request, { action: "business_document.viewed", area: "verification", target: { type: "businessDocuments", id: record.id, label: `${record.storeName} · ${item.kind}` }, after: { documentId: item.id } });
    return respondWithJson(200, { documentId: item.id, fileName: item.fileName, viewUrl: `mock-private-media://business-documents/${record.id}/${item.id}?expires=120`, expiresAt: readIsoTimeOffset(2), watermarkText: `Zudomart Admin, confidential · ${principal.email} · ${readIsoNow()}` });
  });

  registerMockRoute("POST", "/admin/business-documents/:submissionId/documents/:documentId/approve", (request) => reviewDocument(request, "APPROVED"));
  registerMockRoute("POST", "/admin/business-documents/:submissionId/documents/:documentId/reject", (request) => reviewDocument(request, "REJECTED"));
}
