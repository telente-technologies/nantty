import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import type { ModerationAppeal, ModerationDecision } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { ModerationTargetType } from "../../../interfaces/moderationTargets.interface.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type { AppealRecord, AppealStatus, DecisionRecord, ModerationAction, NewDecision, SuspensionRecord } from "../models/moderation.model.js";
import type { AppealResolution, ModerationDecisionsRepository } from "./decisions.repository.js";

function convertDecisionRow(row: ModerationDecision): DecisionRecord {
  return { ...row, targetType: row.targetType as ModerationTargetType, action: row.action as ModerationAction };
}

function convertAppealRow(row: ModerationAppeal): AppealRecord {
  return { ...row, status: row.status as AppealStatus };
}

export class PrismaModerationDecisionsRepository implements ModerationDecisionsRepository {
  public async createDecision(decision: NewDecision, now: Date): Promise<DecisionRecord> {
    return convertDecisionRow(await prisma().moderationDecision.create({ data: { ...decision, createdAt: now } }));
  }

  public async findDecision(decisionId: string): Promise<DecisionRecord | undefined> {
    const row = await prisma().moderationDecision.findUnique({ where: { id: decisionId } });
    return row === null ? undefined : convertDecisionRow(row);
  }

  public async listDecisionsForCase(caseId: string): Promise<readonly DecisionRecord[]> {
    return (await prisma().moderationDecision.findMany({ where: { caseId }, orderBy: { createdAt: "desc" } })).map(convertDecisionRow);
  }

  public async listDecisionsAffectingUser(userId: string, limit: number): Promise<readonly DecisionRecord[]> {
    return (await prisma().moderationDecision.findMany({ where: { affectedUserId: userId }, orderBy: { createdAt: "desc" }, take: limit })).map(convertDecisionRow);
  }

  public async markDecisionReversed(decisionId: string, now: Date): Promise<void> {
    await prisma().moderationDecision.updateMany({ where: { id: decisionId, reversedAt: null }, data: { reversedAt: now } });
  }

  public async createAppeal(appeal: Pick<AppealRecord, "decisionId" | "appellantId" | "statement">, now: Date): Promise<AppealRecord | undefined> {
    try {
      return convertAppealRow(await prisma().moderationAppeal.create({ data: { ...appeal, createdAt: now } }));
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return undefined;
      throw error;
    }
  }

  public async findAppeal(appealId: string): Promise<AppealRecord | undefined> {
    const row = await prisma().moderationAppeal.findUnique({ where: { id: appealId } });
    return row === null ? undefined : convertAppealRow(row);
  }

  public async listAppealsForDecisions(decisionIds: readonly string[]): Promise<readonly AppealRecord[]> {
    return (await prisma().moderationAppeal.findMany({ where: { decisionId: { in: [...decisionIds] } } })).map(convertAppealRow);
  }

  public async listAppeals(status: AppealStatus | undefined, page: PageRequest): Promise<Page<AppealRecord>> {
    const rows = await prisma().moderationAppeal.findMany({
      where: status === undefined ? {} : { status },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertAppealRow);
  }

  public async resolveAppeal(appealId: string, resolution: AppealResolution): Promise<boolean> {
    const result = await prisma().moderationAppeal.updateMany({ where: { id: appealId, status: "pending" }, data: resolution });
    return result.count > 0;
  }

  public createSuspension(suspension: Pick<SuspensionRecord, "userId" | "decisionId" | "endsAt">, now: Date): Promise<SuspensionRecord> {
    return prisma().accountSuspension.create({ data: { ...suspension, createdAt: now } });
  }

  public async findActiveSuspension(userId: string, now: Date): Promise<SuspensionRecord | undefined> {
    const row = await prisma().accountSuspension.findFirst({ where: { userId, liftedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } });
    return row ?? undefined;
  }

  public async liftSuspensionForDecision(decisionId: string, now: Date): Promise<void> {
    await prisma().accountSuspension.updateMany({ where: { decisionId, liftedAt: null }, data: { liftedAt: now } });
  }
}
