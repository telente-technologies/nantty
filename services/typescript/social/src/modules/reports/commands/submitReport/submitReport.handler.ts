import { reportsPerHourLimit } from "../../../../constants/social.constant.js";
import { forbidden, tooManyRequests, unprocessable } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Prisma } from "../../../../generated/prisma/client.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { createBlockUserHandler } from "../../../blocks/commands/blockUser/blockUser.handler.js";
import { requireConversationMember } from "../../../conversations/services/conversationAccess.service.js";
import { reportIntakeRepository } from "../../repositories/reportIntake.repository.js";
import type { SubmitReportCommand } from "./submitReport.command.js";

const evidenceRequiredTargets = new Set(["message", "conversation", "group"]);
const urgentReasons = new Set(["child_safety"]);
const urgentLiveReasons = new Set(["child_safety", "self_harm", "violence"]);

export function classifyReportPriority(reason: string, targetType = ""): "normal" | "urgent" {
  return urgentReasons.has(reason) || (targetType === "live" && urgentLiveReasons.has(reason)) ? "urgent" : "normal";
}

export function createSubmitReportHandler(context: HandlerContext): Handler<SubmitReportCommand, { readonly id: string; readonly status: "received"; readonly priority: "normal" | "urgent" }> {
  const blockUser = createBlockUserHandler(context);
  return async (command) => {
    const db = context.database.client;
    const now = context.clock.now();
    if (command.reason === "other" && command.details.trim() === "") throw unprocessable("DETAILS_REQUIRED", "Tell us what happened.");
    if (evidenceRequiredTargets.has(command.targetType) && command.evidence.length === 0) throw unprocessable("EVIDENCE_REQUIRED", "Attach the messages you're reporting.");
    if ((await reportIntakeRepository.countSince(db, command.reporterId, new Date(now.getTime() - 3_600_000))) >= reportsPerHourLimit) throw tooManyRequests("REPORT_RATE_LIMITED", "You've sent too many reports. Try again later.");
    if (command.conversationId !== undefined && evidenceRequiredTargets.has(command.targetType)) {
      const access = await requireConversationMember(db, command.conversationId, command.reporterId).catch(() => undefined);
      if (access === undefined) throw forbidden("NOT_A_MEMBER", "You can only report conversations you're in.");
    }
    const priority = classifyReportPriority(command.reason, command.targetType);
    const report = await context.database.transaction(async (transaction) => {
      const created = await reportIntakeRepository.create(transaction, { reporterId: command.reporterId, targetType: command.targetType, targetId: command.targetId, reason: command.reason, priority, evidenceHash: command.evidenceHash ?? null });
      await appendDomainEventsToOutbox(transaction, [{
        eventType: socialEventTypes.reportSubmitted, subject: created.id, occurredAt: now,
        data: {
          reportId: created.id, reporterId: command.reporterId, targetType: command.targetType, targetId: command.targetId, reason: command.reason, priority, details: command.details, blockReportedUser: command.blockReportedUser,
          ...(command.conversationId === undefined ? {} : { conversationId: command.conversationId }), ...(command.reportedUserId === undefined ? {} : { reportedUserId: command.reportedUserId }),
          ...(command.evidenceHash === undefined ? {} : { evidenceHash: command.evidenceHash }), evidence: command.evidence as unknown as Prisma.InputJsonArray,
          ...(command.targetType === "live" && command.liveContext !== undefined ? { liveContext: { ...command.liveContext } } : {}),
        },
      }]);
      return created;
    });
    if (command.blockReportedUser && command.reportedUserId !== undefined) await blockUser({ blockerId: command.reporterId, targetId: command.reportedUserId });
    return { id: report.id, status: "received", priority };
  };
}
