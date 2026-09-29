import { forbidden, notFound, unprocessable } from "../../../errors/domain.error.js";
import type { ConversationMemberDto } from "../dtos/messages.dto.js";
import type { ConversationRecord, ParticipantRecord } from "../models/messages.model.js";
import type { ConversationAccess, MessagesService } from "./messages.service.js";

const MEMBER_LIST_LIMIT = 500;

export class GroupMembershipService {
  public constructor(private readonly messagesService: MessagesService) {}

  public async listMembers(conversation: ConversationRecord, viewerIsAdministrator: boolean): Promise<readonly ConversationMemberDto[]> {
    const { conversations, userDirectory } = this.messagesService.dependencies;
    const participants = (await conversations.listParticipants(conversation.id, MEMBER_LIST_LIMIT)).filter(
      (participant) => conversation.kind !== "channel" || viewerIsAdministrator || participant.role === "owner" || participant.role === "admin",
    );
    const users = new Map((await userDirectory.findUserSummaries(participants.map((participant) => participant.userId))).map((user) => [user.id, user]));
    return participants.flatMap((participant) => {
      const user = users.get(participant.userId);
      return user === undefined ? [] : [{ user, role: participant.role === "customer" ? "member" : participant.role }];
    });
  }

  public async addMembers(access: ConversationAccess, userIds: readonly string[]): Promise<readonly ConversationMemberDto[]> {
    const { conversations, userDirectory, socialGraph, clock, settings } = this.messagesService.dependencies;
    const { conversation, viewerId } = access;
    if (conversation.kind !== "group") throw unprocessable("Members can only be added to groups.");
    const candidates = [...new Set(userIds)].filter((userId) => userId !== viewerId);
    const users = await userDirectory.findUserSummaries(candidates);
    if (users.length !== candidates.length) throw notFound("User");
    for (const userId of candidates) {
      if (await socialGraph.isBlockedEitherWay(viewerId, userId)) throw forbidden("You cannot add someone you have blocked or who blocked you.");
    }
    const existingIds = new Set(await conversations.listParticipantUserIds(conversation.id));
    const fresh = users.filter((user) => !existingIds.has(user.id));
    if (existingIds.size + fresh.length > settings.maximumGroupMembers) throw unprocessable(`A group can have at most ${settings.maximumGroupMembers} members.`);
    await conversations.addParticipants(conversation.id, fresh.map((user) => ({ userId: user.id, role: "member" as const })), clock.now());
    for (const user of fresh) await this.messagesService.broadcaster.postSystemNotice(conversation, `${user.name || `@${user.username}`} was added`);
    await this.messagesService.broadcaster.announceConversationChanged(await this.reload(conversation));
    return this.listMembers(conversation, true);
  }

  public async removeMember(access: ConversationAccess, userId: string): Promise<void> {
    const { conversation, participant: actor } = access;
    const target = await this.requireParticipant(conversation, userId);
    if (target.role === "owner") throw forbidden("The owner cannot be removed.");
    if (target.role === "admin" && actor?.role !== "owner") throw forbidden("Only the owner can remove an admin.");
    await this.messagesService.dependencies.conversations.removeParticipant(conversation.id, userId);
    await this.postNoticeAbout(conversation, userId, "was removed");
    await this.messagesService.broadcaster.announceConversationChanged(await this.reload(conversation), [userId]);
  }

  public async promoteToAdministrator(access: ConversationAccess, userId: string): Promise<void> {
    const target = await this.requireParticipant(access.conversation, userId);
    if (target.role === "owner" || target.role === "admin") return;
    await this.messagesService.dependencies.conversations.changeParticipantRole(access.conversation.id, userId, "admin");
    await this.postNoticeAbout(access.conversation, userId, "is now an admin");
  }

  public async demoteAdministrator(access: ConversationAccess, userId: string): Promise<void> {
    const target = await this.requireParticipant(access.conversation, userId);
    if (target.role === "owner") throw forbidden("The owner cannot be demoted.");
    if (target.role !== "admin") return;
    if (access.participant?.role !== "owner" && userId !== access.viewerId) throw forbidden("Only the owner can demote an admin.");
    const role = access.conversation.kind === "channel" ? "subscriber" : "member";
    await this.messagesService.dependencies.conversations.changeParticipantRole(access.conversation.id, userId, role);
    await this.postNoticeAbout(access.conversation, userId, "is no longer an admin");
  }

  public async leave(access: ConversationAccess): Promise<void> {
    const { conversations } = this.messagesService.dependencies;
    const { conversation, participant, viewerId } = access;
    if (conversation.kind === "direct" || conversation.kind === "business" || participant === undefined) throw unprocessable("You can only leave groups and channels.");
    if (participant.role === "owner") {
      if (conversation.kind === "channel") throw unprocessable("Channel owners cannot leave their channel.");
      await this.handOverOwnership(conversation, viewerId);
    }
    await conversations.removeParticipant(conversation.id, viewerId);
    if (conversation.kind === "group") await this.postNoticeAbout(conversation, viewerId, "left the group");
  }

  private async handOverOwnership(conversation: ConversationRecord, leavingOwnerId: string): Promise<void> {
    const { conversations } = this.messagesService.dependencies;
    const others = (await conversations.listParticipants(conversation.id, MEMBER_LIST_LIMIT)).filter((participant) => participant.userId !== leavingOwnerId);
    const successor = others.find((participant) => participant.role === "admin") ?? others[0];
    if (successor === undefined) return;
    await conversations.changeParticipantRole(conversation.id, successor.userId, "owner");
    await conversations.updateSettings(conversation.id, { ownerId: successor.userId });
  }

  private async requireParticipant(conversation: ConversationRecord, userId: string): Promise<ParticipantRecord> {
    const participant = await this.messagesService.dependencies.conversations.findParticipant(conversation.id, userId);
    if (participant === undefined) throw notFound("Member");
    return participant;
  }

  private async postNoticeAbout(conversation: ConversationRecord, userId: string, what: string): Promise<void> {
    if (conversation.kind !== "group") return;
    const [user] = await this.messagesService.dependencies.userDirectory.findUserSummaries([userId]);
    await this.messagesService.broadcaster.postSystemNotice(conversation, `${user?.name || "Someone"} ${what}`);
  }

  private async reload(conversation: ConversationRecord): Promise<ConversationRecord> {
    return (await this.messagesService.dependencies.conversations.findById(conversation.id)) ?? conversation;
  }
}
