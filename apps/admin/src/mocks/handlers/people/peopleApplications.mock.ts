import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { MockHttpError, failNotFound, matchesSearchText, paginateItems, readIsoNow, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { presentPlatformUserSummary } from "@/mocks/seed/demoPlatformUsers.mock";
import { evaluateApplicationEligibility, type MockProgramApplicationRecord } from "@/mocks/seed/peopleApplications.mock";
import type { ApplicationKind, ProgramApplication, ProgramApplicationDetail } from "@/types/applications.type";

import { asMutablePlatformUser, findPlatformUserForPeopleOrFail, readPeopleMockStore } from "./peopleStore.mock";

const permissionByKind = { sellers: "applications:sellers", creators: "applications:creators" } as const;

function presentProgramApplication(record: MockProgramApplicationRecord): ProgramApplication {
  const user = findPlatformUserForPeopleOrFail(record.userId);
  const eligibility = evaluateApplicationEligibility(record, user);
  return {
    id: record.id, kind: record.kind, user: presentPlatformUserSummary(user), status: record.status, submittedAt: record.submittedAt, reviewedAt: record.reviewedAt,
    reviewedByName: record.reviewedByName, decisionReason: record.decisionReason, pitch: record.pitch, storeName: record.storeName, categories: record.categories,
    expectedMonthlySales: record.expectedMonthlySalesMajor === null ? null : { amountMinor: record.expectedMonthlySalesMajor * 100, currency: user.currency },
    contentNiche: record.contentNiche, eligibility, isEligible: eligibility.every((check) => check.isMet),
  };
}

function presentProgramApplicationDetail(record: MockProgramApplicationRecord): ProgramApplicationDetail {
  return { ...presentProgramApplication(record), history: listMockAuditEntriesForTarget("application", record.id) };
}

function findApplicationOrFail(kind: ApplicationKind, applicationId: string | undefined): MockProgramApplicationRecord {
  const record = readPeopleMockStore().applications.find((candidate) => candidate.kind === kind && candidate.id === applicationId);
  if (!record) failNotFound("Application");
  return record;
}

function decideApplication(request: MockRequest, kind: ApplicationKind, decision: "approve" | "reject") {
  const principal = requireMockPermission(request, permissionByKind[kind]);
  const record = findApplicationOrFail(kind, request.params.applicationId);
  const reason = readRequiredReason(readJsonObjectBody(request));
  if (record.status !== "PENDING") throw new MockHttpError(409, "ALREADY_DECIDED", "This application was already decided.");
  const user = findPlatformUserForPeopleOrFail(record.userId);
  const before = { status: record.status, isSeller: user.isSeller, isCreator: user.isCreator };
  record.status = decision === "approve" ? "APPROVED" : "REJECTED";
  record.reviewedAt = readIsoNow();
  record.reviewedByName = principal.name;
  record.decisionReason = reason;
  if (decision === "approve") {
    if (kind === "sellers") asMutablePlatformUser(user).isSeller = true;
    else asMutablePlatformUser(user).isCreator = true;
  }
  recordMockAuditEntry(request, { action: `${kind === "sellers" ? "seller" : "creator"}_application.${decision === "approve" ? "approved" : "rejected"}`, area: "applications", target: { type: "application", id: record.id, label: `@${user.username}` }, reason, before, after: { status: record.status, isSeller: user.isSeller, isCreator: user.isCreator } });
  return respondWithJson(200, presentProgramApplicationDetail(record));
}

export function countPendingApplications(kind: ApplicationKind): { count: number; oldestAt: string | null; breachingSla: number } {
  const pending = readPeopleMockStore().applications.filter((record) => record.kind === kind && record.status === "PENDING");
  return { count: pending.length, oldestAt: pending.map((record) => record.submittedAt).sort()[0] ?? null, breachingSla: pending.filter((record) => Date.now() - Date.parse(record.submittedAt) > 48 * 3_600_000).length };
}

export function registerPeopleApplicationMockHandlers(): void {
  for (const kind of ["sellers", "creators"] as const) {
    registerMockRoute("GET", `/admin/applications/${kind}`, (request) => {
      requireMockPermission(request, permissionByKind[kind]);
      const status = request.query.get("status");
      const items = readPeopleMockStore()
        .applications.filter((record) => record.kind === kind && (!status || status === "ALL" || record.status === status))
        .map(presentProgramApplication)
        .filter((application) => matchesSearchText(request.query.get("search"), application.user.username, application.user.displayName, application.storeName, application.id))
        .sort((first, second) => first.submittedAt.localeCompare(second.submittedAt));
      return respondWithJson(200, paginateItems(items, request));
    });
    registerMockRoute("GET", `/admin/applications/${kind}/:applicationId`, (request) => {
      requireMockPermission(request, permissionByKind[kind]);
      return respondWithJson(200, presentProgramApplicationDetail(findApplicationOrFail(kind, request.params.applicationId)));
    });
    registerMockRoute("POST", `/admin/applications/${kind}/:applicationId/approve`, (request) => decideApplication(request, kind, "approve"));
    registerMockRoute("POST", `/admin/applications/${kind}/:applicationId/reject`, (request) => decideApplication(request, kind, "reject"));
  }
}
