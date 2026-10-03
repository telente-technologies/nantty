import { spamExternalScoreThreshold, spamMetricWindowMilliseconds, spamNewAccountAgeDays, spamNewAccountRecipientsThreshold, spamRecipientsPerHourThreshold } from "../../../constants/spam.constant.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";

export interface SenderBehaviourInput {
  readonly recipientsInWindow: number;
  readonly accountAgeDays: number | null;
  readonly externalScore: number | null;
}

export interface SpamEvaluation {
  readonly spam: boolean;
  readonly reason: string | null;
  readonly score: number | null;
}

export function evaluateSenderBehaviour(input: SenderBehaviourInput): SpamEvaluation {
  if (input.externalScore !== null && input.externalScore >= spamExternalScoreThreshold) return { spam: true, reason: "Flagged by sender behaviour model", score: input.externalScore };
  if (input.recipientsInWindow >= spamRecipientsPerHourThreshold) return { spam: true, reason: "Sent to many new people in the last hour", score: input.externalScore };
  const isNewAccount = input.accountAgeDays !== null && input.accountAgeDays < spamNewAccountAgeDays;
  if (isNewAccount && input.recipientsInWindow >= spamNewAccountRecipientsThreshold) return { spam: true, reason: "New account messaging many people", score: input.externalScore };
  return { spam: false, reason: null, score: input.externalScore };
}

export async function registerNewRecipientAndEvaluate(context: HandlerContext, senderId: string): Promise<SpamEvaluation> {
  const db = context.database.client;
  const now = context.clock.now();
  const existing = await db.senderBehaviourMetric.findUnique({ where: { accountId: senderId } });
  const windowExpired = existing === null || now.getTime() - existing.windowStartedAt.getTime() > spamMetricWindowMilliseconds;
  const recipientsInWindow = windowExpired ? 1 : (existing?.recipientsInWindow ?? 0) + 1;
  await db.senderBehaviourMetric.upsert({
    where: { accountId: senderId },
    create: { accountId: senderId, windowStartedAt: now, recipientsInWindow },
    update: windowExpired ? { windowStartedAt: now, recipientsInWindow } : { recipientsInWindow },
  });
  const createdAt = await context.directory.findAccountCreatedAt(senderId);
  const accountAgeDays = createdAt === undefined ? null : (now.getTime() - createdAt.getTime()) / 86_400_000;
  const externalScore = (await context.spamScores?.scoreSenderBehaviour(senderId, { recipientsInWindow, accountAgeDays })) ?? null;
  return evaluateSenderBehaviour({ recipientsInWindow, accountAgeDays, externalScore });
}
