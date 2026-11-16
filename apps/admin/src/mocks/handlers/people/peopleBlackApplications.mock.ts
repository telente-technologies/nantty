import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { readMockAreaStore } from "@/mocks/mockDatabase.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, createMockId, failNotFound, matchesSearchText, paginateByCursor, readEnumValue, readIsoNow, readJsonObjectBody, readOptionalTrimmedString, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockQueueCounter } from "@/mocks/mockQueueCounters.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { presentPlatformUserSummary } from "@/mocks/seed/demoPlatformUsers.mock";
import { isoMinutesAgo, isoMinutesFromNow } from "@/mocks/seed/trustTime.mock";
import type { BlackApplication, BlackChecklistItem, BlackChecklistKey } from "@/types/blackApplications.type";

import { asMutablePlatformUser, findPlatformUserForPeopleOrFail, readPeopleMockStore } from "./peopleStore.mock";

type BlackRecord = { -readonly [Key in keyof Omit<BlackApplication, "user">]: BlackApplication[Key] } & { readonly userId: string };

const dayMinutes = 1440;
const checklistLabels: { key: BlackChecklistKey; label: string; detail: string }[] = [
  { key: "LETTERHEAD_LETTER", label: "Official letterhead letter", detail: "Signed by an authorised officer of the agency." },
  { key: "OFFICIAL_CHANNEL", label: "Official-channel confirmation", detail: "Confirmed through a published .gov.ng domain or an official phone line." },
  { key: "REPRESENTATIVE", label: "Representative identity", detail: "Government ID, BVN or NIN, and proof of their role." },
  { key: "ENTITY_PROOF", label: "Proof the entity exists", detail: "Official website or gazette entry." },
];

function checklist(verifiedKeys: readonly BlackChecklistKey[]): BlackChecklistItem[] {
  return checklistLabels.map((item) => ({ ...item, isVerified: verifiedKeys.includes(item.key), note: null, verifiedByName: verifiedKeys.includes(item.key) ? "Chidi Okafor" : null }));
}

function buildSeed(): BlackRecord[] {
  const base = {
    firstApproval: null, secondApproval: null, decisionReason: null, reverificationDueAt: null,
    reverificationRemindedAt: null, reverificationReason: null, handleReserved: false, privateCheckoutEnabled: false,
    privateCheckoutExpiresAt: null, officialWebsite: "https://agency.gov.ng", officialContactPhone: "+2348000000001",
  } as const;
  const approved = { name: "Tolu Adeyemi", at: isoMinutesAgo(300 * dayMinutes) };
  return [
    { ...base, id: "blk_0001", userId: "usr_0011", agencyName: "Federal Ministry of Arts", handle: "fmarts.gov", legalIdentityName: "Federal Ministry of Arts", jurisdictionCountryCode: "NG", institutionalEmail: "press@fmarts.gov.ng", institutionalEmailVerified: true, representativeName: "Ifeoma Uche", representativeRole: "Director, Communications", status: "IN_REVIEW", submittedAt: isoMinutesAgo(3 * dayMinutes), checklist: checklist(["LETTERHEAD_LETTER"]) },
    { ...base, id: "blk_0002", userId: "usr_0022", agencyName: "Ogun State Tourism Board", handle: "ogun.tourism.gov", legalIdentityName: "Ogun State Tourism Board", jurisdictionCountryCode: "NG", institutionalEmail: "info@oguntourism.gov.ng", institutionalEmailVerified: true, representativeName: "Tomisin Ajayi", representativeRole: "General Manager", status: "AWAITING_SECOND_APPROVAL", submittedAt: isoMinutesAgo(9 * dayMinutes), checklist: checklist(["LETTERHEAD_LETTER", "OFFICIAL_CHANNEL", "REPRESENTATIVE", "ENTITY_PROOF"]), firstApproval: { adminId: "adm_0002", name: "Chidi Okafor", at: isoMinutesAgo(dayMinutes) } },
    { ...base, id: "blk_0003", userId: "usr_0010", agencyName: "Lagos State Government", handle: "lagosstate.gov", legalIdentityName: "Lagos State Government", jurisdictionCountryCode: "NG", institutionalEmail: "digital@lagosstate.gov.ng", institutionalEmailVerified: true, representativeName: "Biodun Salami", representativeRole: "Head of Digital", status: "APPROVED", submittedAt: isoMinutesAgo(320 * dayMinutes), checklist: checklist(["LETTERHEAD_LETTER", "OFFICIAL_CHANNEL", "REPRESENTATIVE", "ENTITY_PROOF"]), firstApproval: { adminId: "adm_0002", name: "Chidi Okafor", at: isoMinutesAgo(301 * dayMinutes) }, secondApproval: { adminId: "adm_0001", name: approved.name, at: approved.at }, reverificationDueAt: isoMinutesFromNow(20 * dayMinutes), reverificationRemindedAt: null, handleReserved: true, privateCheckoutEnabled: true, privateCheckoutExpiresAt: isoMinutesFromNow(14 * dayMinutes) },
  ];
}

function readRecords(): BlackRecord[] {
  return readMockAreaStore("people:blackApplications", buildSeed);
}

function present(record: BlackRecord): BlackApplication {
  const { userId, ...rest } = record;
  return { ...rest, user: presentPlatformUserSummary(findPlatformUserForPeopleOrFail(userId)) };
}

function findOrFail(request: MockRequest): BlackRecord {
  const record = readRecords().find((candidate) => candidate.id === request.params.applicationId);
  if (!record) failNotFound("Black application");
  return record;
}

function audit(request: MockRequest, record: BlackRecord, action: string, reason: string | null, before: unknown, after: unknown) {
  recordMockAuditEntry(request, { action: `black_application.${action}`, area: "verification", target: { type: "blackApplication", id: record.id, label: record.agencyName }, reason, before, after });
}

function reserveHandle(request: MockRequest, record: BlackRecord) {
  const store = readPeopleMockStore();
  if (!store.reservedUsernames.some((entry) => entry.value === record.handle && entry.kind === "EXACT")) {
    store.reservedUsernames.unshift({ id: createMockId("rsv"), value: record.handle, kind: "EXACT", category: "GOVERNMENT", note: `Black handle for ${record.agencyName}. Stays reserved even if billing lapses.`, addedAt: readIsoNow(), addedByName: request.principal?.name ?? "System" });
  }
  record.handleReserved = true;
}

export function registerPeopleBlackApplicationMockHandlers(): void {
  registerMockQueueCounter({ key: "blackApplications", label: "Black applications", href: "/verification/black", readCount: () => {
    const open = readRecords().filter((record) => record.status === "IN_REVIEW" || record.status === "AWAITING_SECOND_APPROVAL");
    return { count: open.length, oldestAt: open.map((record) => record.submittedAt).sort()[0] ?? null };
  } });

  registerMockRoute("GET", "/admin/black-applications", (request) => {
    requireMockPermission(request, "verification:review", "verification:revoke");
    const status = request.query.get("status") ?? "OPEN";
    const search = request.query.get("search");
    const items = readRecords().map(present).filter((item) => (status === "OPEN" ? item.status === "PENDING" || item.status === "IN_REVIEW" || item.status === "AWAITING_SECOND_APPROVAL" || item.status === "REVERIFICATION_REQUIRED" : status === "REVERIFY" ? item.status === "APPROVED" : status === "ALL" || item.status === status)).filter((item) => matchesSearchText(search, item.agencyName, item.handle, item.id)).sort((first, second) => first.submittedAt.localeCompare(second.submittedAt));
    return respondWithJson(200, paginateByCursor(items, request));
  });

  registerMockRoute("POST", "/admin/black-applications/:applicationId/checklist", (request) => {
    const principal = requireMockPermission(request, "verification:review");
    const record = findOrFail(request);
    if (record.status !== "IN_REVIEW" && record.status !== "AWAITING_SECOND_APPROVAL") throw new MockHttpError(409, "NOT_OPEN", "This application is no longer open.");
    const body = readJsonObjectBody(request);
    const key = readEnumValue(body, "key", checklistLabels.map((item) => item.key));
    const isVerified = body.isVerified === true;
    const note = readOptionalTrimmedString(body, "note", 300);
    record.checklist = record.checklist.map((item) => item.key === key ? { ...item, isVerified, note, verifiedByName: isVerified ? principal.name : null } : item);
    audit(request, record, "checklist_updated", note, null, { key, isVerified });
    return respondWithJson(200, present(record));
  });

  registerMockRoute("POST", "/admin/black-applications/:applicationId/approve", (request) => {
    const principal = requireMockPermission(request, "verification:review");
    requireMockStepUp(request);
    const reason = readRequiredReason(readJsonObjectBody(request));
    const record = findOrFail(request);
    if (record.status !== "IN_REVIEW" && record.status !== "AWAITING_SECOND_APPROVAL") throw new MockHttpError(409, "NOT_OPEN", "This application is no longer open.");
    if (!record.checklist.every((item) => item.isVerified)) throw new MockHttpError(409, "CHECKLIST_INCOMPLETE", "Finish the vetting checklist before approving.");
    const approval = { adminId: principal.adminId, name: principal.name, at: readIsoNow() };
    const before = { status: record.status };
    if (!record.firstApproval) {
      record.firstApproval = approval;
      record.status = "AWAITING_SECOND_APPROVAL";
      audit(request, record, "first_approval", reason, before, { status: record.status });
      return respondWithJson(200, present(record));
    }
    if (record.firstApproval.adminId === principal.adminId) throw new MockHttpError(409, "SAME_ADMIN", "A different admin must give the second approval.");
    record.secondApproval = approval;
    record.status = "APPROVED";
    record.reverificationDueAt = isoMinutesFromNow(365 * dayMinutes);
    record.privateCheckoutEnabled = true;
    record.privateCheckoutExpiresAt = isoMinutesFromNow(14 * dayMinutes);
    // Verification unlocks private checkout & reserves the handle, but badge remains hidden until paid USD subscription settles.
    asMutablePlatformUser(findPlatformUserForPeopleOrFail(record.userId)).verification = { color: "BLACK", tier: "OFFICIAL", status: "EXPIRED", badgeVisible: false };
    reserveHandle(request, record);
    audit(request, record, "approved", reason, before, { status: record.status, makers: [record.firstApproval.name, principal.name], handleReserved: true, privateCheckoutEnabled: true, reverificationDueAt: record.reverificationDueAt });
    return respondWithJson(200, present(record));
  });

  registerMockRoute("POST", "/admin/black-applications/:applicationId/reject", (request) => {
    requireMockPermission(request, "verification:review");
    requireMockStepUp(request);
    const reason = readRequiredReason(readJsonObjectBody(request));
    const record = findOrFail(request);
    if (record.status !== "IN_REVIEW" && record.status !== "AWAITING_SECOND_APPROVAL") throw new MockHttpError(409, "NOT_OPEN", "This application is no longer open.");
    const before = { status: record.status };
    record.status = "REJECTED";
    record.decisionReason = reason;
    audit(request, record, "rejected", reason, before, { status: record.status });
    return respondWithJson(200, present(record));
  });

  registerMockRoute("POST", "/admin/black-applications/:applicationId/revoke", (request) => {
    requireMockPermission(request, "verification:revoke");
    requireMockStepUp(request);
    const reason = readRequiredReason(readJsonObjectBody(request));
    const record = findOrFail(request);
    if (record.status !== "APPROVED") throw new MockHttpError(409, "NOT_APPROVED", "Only an approved Black checkmark can be revoked.");
    record.status = "REVOKED";
    record.decisionReason = reason;
    record.reverificationDueAt = null;
    asMutablePlatformUser(findPlatformUserForPeopleOrFail(record.userId)).verification = null;
    audit(request, record, "revoked", reason, { status: "APPROVED" }, { status: "REVOKED", handleStillReserved: record.handleReserved });
    return respondWithJson(200, present(record));
  });

  registerMockRoute("POST", "/admin/black-applications/:applicationId/reverification-reminder", (request) => {
    requireMockPermission(request, "verification:review");
    const record = findOrFail(request);
    if (record.status !== "APPROVED") throw new MockHttpError(409, "NOT_APPROVED", "Only approved agencies are re-verified.");
    record.reverificationRemindedAt = readIsoNow();
    audit(request, record, "reverification_reminder_sent", null, null, { remindedAt: record.reverificationRemindedAt });
    return respondWithJson(200, present(record));
  });

  registerMockRoute("POST", "/admin/black-applications/:applicationId/require-reverification", (request) => {
    requireMockPermission(request, "verification:review");
    requireMockStepUp(request);
    const reason = readRequiredReason(readJsonObjectBody(request));
    const record = findOrFail(request);
    record.status = "REVERIFICATION_REQUIRED";
    record.reverificationReason = reason;
    record.privateCheckoutEnabled = false;
    audit(request, record, "reverification_required", reason, null, { status: record.status });
    return respondWithJson(200, present(record));
  });

  registerMockRoute("POST", "/admin/black-applications/:applicationId/checkout-authorization", (request) => {
    requireMockPermission(request, "verification:review");
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    const record = findOrFail(request);
    record.privateCheckoutEnabled = body.enabled === true;
    record.privateCheckoutExpiresAt = record.privateCheckoutEnabled ? isoMinutesFromNow(14 * dayMinutes) : null;
    audit(request, record, "checkout_authorization_updated", reason, null, { enabled: record.privateCheckoutEnabled });
    return respondWithJson(200, present(record));
  });

  registerMockRoute("GET", "/admin/black-applications/appeals", (request) => {
    requireMockPermission(request, "verification:review", "verification:revoke");
    return respondWithJson(200, { items: [], nextCursor: null });
  });

  registerMockRoute("GET", "/admin/subscriptions/government-black", (request) => {
    requireMockPermission(request, "config:read", "config:plans", "config:revenue");
    return respondWithJson(200, {
      data: [
        {
          subscription: {
            subscriptionId: "sub_black_lagos", profileId: "prof_lagos", status: "active",
            cardLabel: "Visa •••• 4242", billingAuthorizationId: "auth_lagos", cardUsable: true,
            currentPeriodEnd: isoMinutesFromNow(25 * dayMinutes), nextChargeAt: isoMinutesFromNow(25 * dayMinutes),
            cancelAtPeriodEnd: false, price: { amountMinor: 30_000, currency: "USD" },
          },
          verification: {
            applicationId: "blk_0003", agencyName: "Lagos State Government", handle: "lagosstate.gov",
            status: "approved", jurisdictionCountryCode: "NG", institutionalEmail: "digital@lagosstate.gov.ng",
            institutionalEmailVerified: true, privateCheckoutEnabled: true,
          },
          recentPeriods: [], recentEvents: [],
        },
      ],
      nextCursor: null,
    });
  });
}
