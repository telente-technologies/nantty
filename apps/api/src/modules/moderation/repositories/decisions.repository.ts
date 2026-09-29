import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import {
  isSuspensionActive,
  type AppealRecord,
  type AppealStatus,
  type DecisionRecord,
  type NewDecision,
  type SuspensionRecord,
} from "../models/moderation.model.js";

export type AppealResolution = Pick<AppealRecord, "status" | "reviewerId" | "reviewNote" | "resolvedAt">;

export interface ModerationDecisionsRepository {
  createDecision(decision: NewDecision, now: Date): Promise<DecisionRecord>;
  findDecision(decisionId: string): Promise<DecisionRecord | undefined>;
  listDecisionsForCase(caseId: string): Promise<readonly DecisionRecord[]>;
  listDecisionsAffectingUser(userId: string, limit: number): Promise<readonly DecisionRecord[]>;
  markDecisionReversed(decisionId: string, now: Date): Promise<void>;
  createAppeal(appeal: Pick<AppealRecord, "decisionId" | "appellantId" | "statement">, now: Date): Promise<AppealRecord | undefined>;
  findAppeal(appealId: string): Promise<AppealRecord | undefined>;
  listAppealsForDecisions(decisionIds: readonly string[]): Promise<readonly AppealRecord[]>;
  listAppeals(status: AppealStatus | undefined, page: PageRequest): Promise<Page<AppealRecord>>;
  resolveAppeal(appealId: string, resolution: AppealResolution): Promise<boolean>;
  createSuspension(suspension: Pick<SuspensionRecord, "userId" | "decisionId" | "endsAt">, now: Date): Promise<SuspensionRecord>;
  findActiveSuspension(userId: string, now: Date): Promise<SuspensionRecord | undefined>;
  liftSuspensionForDecision(decisionId: string, now: Date): Promise<void>;
}

export class InMemoryModerationDecisionsRepository implements ModerationDecisionsRepository {
  private readonly decisions = new Map<string, DecisionRecord>();
  private readonly appeals = new Map<string, AppealRecord>();
  private readonly suspensions = new Map<string, SuspensionRecord>();

  public async createDecision(decision: NewDecision, now: Date): Promise<DecisionRecord> {
    const record: DecisionRecord = { ...decision, id: randomUUID(), reversedAt: null, createdAt: now };
    this.decisions.set(record.id, record);
    return record;
  }

  public async findDecision(decisionId: string): Promise<DecisionRecord | undefined> {
    return this.decisions.get(decisionId);
  }

  public async listDecisionsForCase(caseId: string): Promise<readonly DecisionRecord[]> {
    return [...this.decisions.values()].filter((decision) => decision.caseId === caseId).sort(compareByNewestFirst);
  }

  public async listDecisionsAffectingUser(userId: string, limit: number): Promise<readonly DecisionRecord[]> {
    return [...this.decisions.values()].filter((decision) => decision.affectedUserId === userId).sort(compareByNewestFirst).slice(0, limit);
  }

  public async markDecisionReversed(decisionId: string, now: Date): Promise<void> {
    const existing = this.decisions.get(decisionId);
    if (existing !== undefined) this.decisions.set(decisionId, { ...existing, reversedAt: now });
  }

  public async createAppeal(appeal: Pick<AppealRecord, "decisionId" | "appellantId" | "statement">, now: Date): Promise<AppealRecord | undefined> {
    if ([...this.appeals.values()].some((existing) => existing.decisionId === appeal.decisionId)) return undefined;
    const record: AppealRecord = { ...appeal, id: randomUUID(), status: "pending", reviewerId: null, reviewNote: null, createdAt: now, resolvedAt: null };
    this.appeals.set(record.id, record);
    return record;
  }

  public async findAppeal(appealId: string): Promise<AppealRecord | undefined> {
    return this.appeals.get(appealId);
  }

  public async listAppealsForDecisions(decisionIds: readonly string[]): Promise<readonly AppealRecord[]> {
    return [...this.appeals.values()].filter((appeal) => decisionIds.includes(appeal.decisionId));
  }

  public async listAppeals(status: AppealStatus | undefined, page: PageRequest): Promise<Page<AppealRecord>> {
    return paginateSortedItems([...this.appeals.values()].filter((appeal) => status === undefined || appeal.status === status).sort(compareByNewestFirst), page);
  }

  public async resolveAppeal(appealId: string, resolution: AppealResolution): Promise<boolean> {
    const existing = this.appeals.get(appealId);
    if (existing === undefined || existing.status !== "pending") return false;
    this.appeals.set(appealId, { ...existing, ...resolution });
    return true;
  }

  public async createSuspension(suspension: Pick<SuspensionRecord, "userId" | "decisionId" | "endsAt">, now: Date): Promise<SuspensionRecord> {
    const record: SuspensionRecord = { ...suspension, id: randomUUID(), liftedAt: null, createdAt: now };
    this.suspensions.set(record.id, record);
    return record;
  }

  public async findActiveSuspension(userId: string, now: Date): Promise<SuspensionRecord | undefined> {
    return [...this.suspensions.values()].find((suspension) => suspension.userId === userId && isSuspensionActive(suspension, now));
  }

  public async liftSuspensionForDecision(decisionId: string, now: Date): Promise<void> {
    for (const suspension of this.suspensions.values()) {
      if (suspension.decisionId === decisionId && suspension.liftedAt === null) this.suspensions.set(suspension.id, { ...suspension, liftedAt: now });
    }
  }
}
