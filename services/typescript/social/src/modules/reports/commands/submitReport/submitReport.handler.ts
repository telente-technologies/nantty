import { forbidden, notFound, SocialError, unprocessable } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Prisma } from "../../../../generated/prisma/client.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { blockUserInTransaction } from "../../../blocks/services/blockUserInTransaction.service.js";
import { findDirectPeerId, requireConversationMember } from "../../../conversations/services/conversationAccess.service.js";
import { reportIntakeRepository } from "../../repositories/reportIntake.repository.js";
import { lockAndCheckReportRateLimit } from "../../services/reportRateLimit.service.js";
import { moderationReasonFor } from "../../services/reportReasons.service.js";
import { assertReportableBy } from "../../services/reportTarget.service.js";
import type { SubmitReportCommand } from "./submitReport.command.js";

const evidenceRequiredTargets = new Set(["message", "conversation", "group"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const urgentReasons = new Set(["child_safety"]);
const urgentLiveReasons = new Set(["child_safety", "self_harm", "violence"]);

export function classifyReportPriority(reason: string, targetType = ""): "normal" | "urgent" {
  return urgentReasons.has(reason) || (targetType === "live" && urgentLiveReasons.has(reason)) ? "urgent" : "normal";
}

export function createSubmitReportHandler(context: HandlerContext): Handler<SubmitReportCommand, { readonly id: string; readonly status: "received"; readonly priority: "normal" | "urgent" }> {
  return async (command) => {
    const db = context.database.client;
    const now = context.clock.now();
    if (command.reason === "other" && command.details.trim() === "") throw unprocessable("DETAILS_REQUIRED", "Tell us what happened.");
    if (evidenceRequiredTargets.has(command.targetType) && command.evidence.length === 0) throw unprocessable("EVIDENCE_REQUIRED", "Attach the messages you're reporting.");
    if (evidenceRequiredTargets.has(command.targetType) && command.conversationId === undefined) throw unprocessable("CONVERSATION_REQUIRED", "Choose the conversation this report is about.");
    if (command.blockReportedUser) {
      if (command.reportedUserId === undefined) throw unprocessable("REPORTED_USER_REQUIRED", "Choose the account you want to block.");
      if (!(await context.directory.findUserSummaries([command.reportedUserId])).has(command.reportedUserId)) throw notFound("USER_NOT_FOUND", "User not found.");
    }
    let resolvedReportedUserId = command.reportedUserId;
    if (command.conversationId !== undefined && evidenceRequiredTargets.has(command.targetType)) {
      const access = await requireConversationMember(db, command.conversationId, command.reporterId).catch(() => undefined);
      if (access === undefined) throw forbidden("NOT_A_MEMBER", "You can only report conversations you're in.");
      if (command.targetType !== "message" && command.targetId !== command.conversationId) throw notFound("TARGET_NOT_FOUND", "We couldn't find what you're reporting.");
      if (command.targetType === "message") {
        if (!uuidPattern.test(command.targetId)) throw notFound("TARGET_NOT_FOUND", "We couldn't find what you're reporting.");
        const message = await db.message.findFirst({ where: { id: command.targetId, conversationId: command.conversationId }, select: { senderId: true } });
        if (message === null) throw notFound("TARGET_NOT_FOUND", "We couldn't find what you're reporting.");
        resolvedReportedUserId = message.senderId;
      } else if (command.targetType === "conversation") {
        const otherMembers = access.conversation.members.filter((member) => member.accountId !== command.reporterId);
        const peerId = access.conversation.kind === "business" && otherMembers.length === 1
          ? otherMembers[0]?.accountId
          : findDirectPeerId(access.conversation, command.reporterId);
        if (peerId === undefined) throw notFound("TARGET_NOT_FOUND", "We couldn't find what you're reporting.");
        resolvedReportedUserId = peerId;
      } else if (command.targetType === "group") {
        if (access.conversation.kind !== "group" && access.conversation.kind !== "channel") throw notFound("TARGET_NOT_FOUND", "We couldn't find what you're reporting.");
        if (command.reportedUserId !== undefined && !access.conversation.members.some((member) => member.accountId === command.reportedUserId)) throw unprocessable("REPORT_TARGET_MISMATCH", "The reported account isn't in this group.");
      }
      if (command.reportedUserId !== undefined && resolvedReportedUserId !== command.reportedUserId) throw unprocessable("REPORT_TARGET_MISMATCH", "The reported account doesn't match this conversation.");
    }
    const localOwnerId = await assertReportableBy(db, command.reporterId, { ...command, reportedUserId: resolvedReportedUserId });
    if (command.targetType === "user") {
      resolvedReportedUserId = command.targetId;
      if (command.reportedUserId !== undefined && command.reportedUserId !== command.targetId) throw unprocessable("REPORT_TARGET_MISMATCH", "The reported account doesn't match this profile.");
      if (!(await context.directory.findUserSummaries([resolvedReportedUserId])).has(resolvedReportedUserId)) throw notFound("USER_NOT_FOUND", "User not found.");
    } else if (localOwnerId !== undefined) {
      resolvedReportedUserId = localOwnerId;
    }
    if (command.targetType === "live" || command.targetType === "space" || command.targetType === "product" || command.targetType === "store") {
      try {
        const ownerId = await context.reportTargets?.resolveOwner(command.targetType, command.targetId);
        if (ownerId === undefined) throw new Error("Report target resolution is not configured");
        if (ownerId === null) throw notFound("TARGET_NOT_FOUND", "We couldn't find what you're reporting.");
        if (ownerId === command.reporterId) throw unprocessable("SELF_REPORT", "You can't report your own content.");
        if (command.reportedUserId !== undefined && ownerId !== command.reportedUserId) throw unprocessable("REPORT_TARGET_MISMATCH", "The reported account doesn't match this content.");
        resolvedReportedUserId = ownerId;
      } catch (error) {
        if (error instanceof SocialError) throw error;
        throw new SocialError(503, "REPORT_TARGET_UNAVAILABLE", "We couldn't verify this report target. Please try again.");
      }
    }
    const priority = classifyReportPriority(command.reason, command.targetType);
    const report = await context.database.transaction(async (transaction) => {
      await lockAndCheckReportRateLimit(transaction, command.reporterId, new Date(now.getTime() - 3_600_000));
      const created = await reportIntakeRepository.create(transaction, { reporterId: command.reporterId, targetType: command.targetType, targetId: command.targetId, reason: command.reason, priority, evidenceHash: command.evidenceHash ?? null });
      await appendDomainEventsToOutbox(transaction, [{
        eventType: socialEventTypes.reportSubmitted, subject: created.id, occurredAt: now,
        data: {
          reportId: created.id, reporterId: command.reporterId, targetType: command.targetType, targetId: command.targetId, reason: moderationReasonFor(command.reason), priority, details: command.details, blockReportedUser: command.blockReportedUser,
          ...(command.conversationId === undefined ? {} : { conversationId: command.conversationId }), ...(resolvedReportedUserId === undefined ? {} : { reportedUserId: resolvedReportedUserId }),
          ...(command.evidenceHash === undefined ? {} : { evidenceHash: command.evidenceHash }), evidence: command.evidence as unknown as Prisma.InputJsonArray,
          ...(command.targetType === "live" && command.liveContext !== undefined ? { liveContext: { ...command.liveContext } } : {}),
        },
      }]);
      if (command.blockReportedUser && command.reportedUserId !== undefined) {
        await blockUserInTransaction(transaction, command.reporterId, command.reportedUserId, now);
      }
      return created;
    });
    return { id: report.id, status: "received", priority };
  };
}
