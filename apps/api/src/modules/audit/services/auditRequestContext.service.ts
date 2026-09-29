import { AsyncLocalStorage } from "node:async_hooks";

import type { AuditActorKind } from "../../../interfaces/audit.interface.js";

export interface AuditRequestContext {
  readonly actorId: string;
  readonly actorKind: AuditActorKind;
  readonly actorName: string;
  readonly actorRole: string | null;
  readonly ip: string | null;
  readonly requestId: string | null;
  readonly stepUpVerified: boolean;
  recordedEntries: number;
}

const storage = new AsyncLocalStorage<AuditRequestContext>();

export function runWithAuditRequestContext<T>(context: AuditRequestContext, work: () => Promise<T>): Promise<T> {
  return storage.run(context, work);
}

export function findAuditRequestContext(): AuditRequestContext | undefined {
  return storage.getStore();
}
