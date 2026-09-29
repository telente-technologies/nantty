import type { AdminPermission } from "@/constants/adminPermissions.constant";
import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { readMockAreaStore } from "@/mocks/mockDatabase.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, failNotFound, failValidation, readIsoNow, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { VersionedRecord } from "@/types/platformConfiguration.type";

interface VersionedCollectionStore<Content> {
  readonly history: Map<string, VersionedRecord<Content>[]>;
}

export interface VersionedCollectionDefinition<Content> {
  readonly storeName: string;
  readonly basePath: string;
  readonly readPermissions: readonly AdminPermission[];
  readonly readWritePermissionForRecord: (recordId: string) => AdminPermission;
  readonly auditActionPrefix: string;
  readonly auditTargetType: string;
  readonly describeRecordForAudit: (recordId: string, content: Content) => string;
  readonly createInitialRecords: () => readonly { id: string; content: Content; changeReason: string }[];
  readonly validateIncomingContent: (rawContent: unknown, recordId: string, currentContent: Content | null) => Content;
  readonly isValidNewRecordId: (recordId: string) => boolean;
  readonly canCreate: boolean;
  readonly canArchive: boolean;
}

const seedAuthor = { id: "adm_0006", name: "Aisha Garba" };

function readCollectionStore<Content>(definition: VersionedCollectionDefinition<Content>): VersionedCollectionStore<Content> {
  return readMockAreaStore(`configuration:${definition.storeName}`, () => {
    const history = new Map<string, VersionedRecord<Content>[]>();
    definition.createInitialRecords().forEach((record, index) => {
      const updatedAt = new Date(Date.now() - (index + 3) * 86_400_000).toISOString();
      history.set(record.id, [{ id: record.id, version: 1, updatedAt, updatedBy: seedAuthor, changeReason: record.changeReason, isArchived: false, content: record.content }]);
    });
    return { history };
  });
}

export function readCurrentVersionedRecords<Content>(definition: VersionedCollectionDefinition<Content>): VersionedRecord<Content>[] {
  return [...readCollectionStore(definition).history.values()].map((versions) => versions[versions.length - 1]!).filter((record) => !record.isArchived);
}

function readVersionsOrFail<Content>(definition: VersionedCollectionDefinition<Content>, recordId: string): VersionedRecord<Content>[] {
  const versions = readCollectionStore(definition).history.get(recordId);
  if (!versions) failNotFound("Configuration record");
  return versions;
}

function readExpectedVersion(body: Record<string, unknown>): number {
  const expectedVersion = body.expectedVersion;
  if (typeof expectedVersion !== "number" || !Number.isInteger(expectedVersion) || expectedVersion < 0) failValidation("expectedVersion", "expectedVersion must be the version you edited.");
  return expectedVersion;
}

function appendNewVersion<Content>(request: MockRequest, definition: VersionedCollectionDefinition<Content>, recordId: string, expectedVersion: number, reason: string, content: Content, verb: string, isArchived = false): VersionedRecord<Content> {
  const store = readCollectionStore(definition);
  const versions = store.history.get(recordId) ?? [];
  const current = versions[versions.length - 1] ?? null;
  const currentVersion = current?.version ?? 0;
  const isRecreatingArchivedRecord = current?.isArchived === true && expectedVersion === 0;
  if (expectedVersion !== currentVersion && !isRecreatingArchivedRecord) {
    throw new MockHttpError(409, "VERSION_CONFLICT", `Someone saved version ${currentVersion} after you started editing. Reload to see their changes, then apply yours again.`, [], { currentVersion });
  }
  const principal = request.principal!;
  const record: VersionedRecord<Content> = { id: recordId, version: currentVersion + 1, updatedAt: readIsoNow(), updatedBy: { id: principal.adminId, name: principal.name }, changeReason: reason, isArchived, content };
  store.history.set(recordId, [...versions, record]);
  recordMockAuditEntry(request, {
    action: `${definition.auditActionPrefix}.${verb}`,
    area: "config",
    target: { type: definition.auditTargetType, id: recordId, label: `${definition.describeRecordForAudit(recordId, content)} v${record.version}` },
    reason,
    before: current && !current.isArchived ? current.content : null,
    after: isArchived ? null : content,
  });
  return record;
}

export function registerVersionedCollectionRoutes<Content>(definition: VersionedCollectionDefinition<Content>): void {
  const { basePath } = definition;

  registerMockRoute("GET", basePath, (request) => {
    requireMockPermission(request, ...definition.readPermissions);
    return respondWithJson(200, { items: readCurrentVersionedRecords(definition) });
  });

  registerMockRoute("GET", `${basePath}/:recordId`, (request) => {
    requireMockPermission(request, ...definition.readPermissions);
    const versions = readVersionsOrFail(definition, request.params.recordId ?? "");
    const current = versions[versions.length - 1]!;
    if (current.isArchived) failNotFound("Configuration record");
    return respondWithJson(200, current);
  });

  registerMockRoute("GET", `${basePath}/:recordId/versions`, (request) => {
    requireMockPermission(request, ...definition.readPermissions);
    return respondWithJson(200, { items: [...readVersionsOrFail(definition, request.params.recordId ?? "")].reverse() });
  });

  registerMockRoute("PUT", `${basePath}/:recordId`, (request) => {
    const recordId = request.params.recordId ?? "";
    requireMockPermission(request, definition.readWritePermissionForRecord(recordId));
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const expectedVersion = readExpectedVersion(body);
    const reason = readRequiredReason(body);
    const versions = readCollectionStore(definition).history.get(recordId);
    const current = versions?.[versions.length - 1] ?? null;
    const isCreating = !current || current.isArchived;
    if (isCreating && (!definition.canCreate || !definition.isValidNewRecordId(recordId))) {
      if (!definition.canCreate) failNotFound("Configuration record");
      failValidation("id", "Use lowercase letters, digits, dots and underscores (3–64 characters).");
    }
    const content = definition.validateIncomingContent(body.content, recordId, isCreating ? null : current.content);
    const record = appendNewVersion(request, definition, recordId, expectedVersion, reason, content, isCreating ? "created" : "updated");
    return respondWithJson(isCreating ? 201 : 200, record);
  });

  registerMockRoute("POST", `${basePath}/:recordId/versions/:version/restore`, (request) => {
    const recordId = request.params.recordId ?? "";
    requireMockPermission(request, definition.readWritePermissionForRecord(recordId));
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const expectedVersion = readExpectedVersion(body);
    const reason = readRequiredReason(body);
    const target = readVersionsOrFail(definition, recordId).find((candidate) => candidate.version === Number(request.params.version));
    if (!target || target.isArchived) failNotFound("Version");
    const content = definition.validateIncomingContent(target.content, recordId, target.content);
    return respondWithJson(200, appendNewVersion(request, definition, recordId, expectedVersion, reason, content, "restored"));
  });

  if (definition.canArchive) {
    registerMockRoute("DELETE", `${basePath}/:recordId`, (request) => {
      const recordId = request.params.recordId ?? "";
      requireMockPermission(request, definition.readWritePermissionForRecord(recordId));
      requireMockStepUp(request);
      const body = readJsonObjectBody(request);
      const versions = readVersionsOrFail(definition, recordId);
      const current = versions[versions.length - 1]!;
      if (current.isArchived) failNotFound("Configuration record");
      const record = appendNewVersion(request, definition, recordId, readExpectedVersion(body), readRequiredReason(body), current.content, "archived", true);
      return respondWithJson(200, record);
    });
  }
}
