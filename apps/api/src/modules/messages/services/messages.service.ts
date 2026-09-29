import type { EventBus } from "@zudojs/events";

import { forbidden, notFound } from "../../../errors/domain.error.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { MediaLibrary } from "../../../interfaces/mediaLibrary.interface.js";
import type { RealtimePublisher } from "../../../interfaces/realtimePublisher.interface.js";
import type { SocialGraph } from "../../../interfaces/socialGraph.interface.js";
import type { StoreAccess } from "../../../interfaces/storeAccess.interface.js";
import type { UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import { isAdministratorRole, type ConversationRecord, type ParticipantRecord } from "../models/messages.model.js";
import type { ConversationsRepository } from "../repositories/conversations.repository.js";
import type { MessagesRepository } from "../repositories/messages.repository.js";
import { ConversationBroadcaster } from "./conversationBroadcaster.service.js";
import { ConversationPresenter } from "./conversationPresenter.service.js";
import { MessagePresenter } from "./messagePresenter.service.js";

export interface MessagingSettings {
  readonly publicBaseUrl: string;
  readonly maximumGroupMembers: number;
}

export interface MessagesDependencies {
  readonly conversations: ConversationsRepository;
  readonly messages: MessagesRepository;
  readonly userDirectory: UserDirectory;
  readonly socialGraph: SocialGraph;
  readonly storeAccess: StoreAccess;
  readonly mediaLibrary: MediaLibrary;
  readonly realtime: RealtimePublisher;
  readonly events: EventBus;
  readonly clock: Clock;
  readonly settings: MessagingSettings;
}

export interface ConversationAccess {
  readonly conversation: ConversationRecord;
  readonly viewerId: string;
  readonly participant: ParticipantRecord | undefined;
  readonly actsForStoreId: string | null;
}

export class MessagesService {
  public readonly messagePresenter: MessagePresenter;
  public readonly conversationPresenter: ConversationPresenter;
  public readonly broadcaster: ConversationBroadcaster;

  public constructor(public readonly dependencies: MessagesDependencies) {
    this.messagePresenter = new MessagePresenter(this);
    this.conversationPresenter = new ConversationPresenter(this, this.messagePresenter);
    this.broadcaster = new ConversationBroadcaster(this);
  }

  public async requireConversationAccess(conversationId: string, userId: string): Promise<ConversationAccess> {
    const { conversations, storeAccess } = this.dependencies;
    const conversation = await conversations.findById(conversationId);
    if (conversation === undefined) throw notFound("Conversation");
    const participant = await conversations.findParticipant(conversation.id, userId);
    if (participant !== undefined) return { conversation, viewerId: userId, participant, actsForStoreId: null };
    if (conversation.kind === "business" && conversation.storeId !== null) {
      const isStoreMember = await storeAccess.assertStoreMember(userId, conversation.storeId).then(() => true, () => false);
      if (isStoreMember) return { conversation, viewerId: userId, participant: undefined, actsForStoreId: conversation.storeId };
    }
    throw notFound("Conversation");
  }

  public async requireGroupAdministrator(conversationId: string, userId: string): Promise<ConversationAccess> {
    const access = await this.requireConversationAccess(conversationId, userId);
    if (access.conversation.kind !== "group" && access.conversation.kind !== "channel") throw forbidden("Only groups and channels have administrators.");
    if (!isAdministratorRole(access.participant?.role)) throw forbidden("Only group admins can do this.");
    return access;
  }

  public async assertMayPostMessage(access: ConversationAccess): Promise<void> {
    const { conversation, participant, viewerId } = access;
    if (conversation.kind === "channel" && !isAdministratorRole(participant?.role)) throw forbidden("Only channel admins can post in this channel.");
    if (conversation.kind !== "direct") return;
    const others = (await this.dependencies.conversations.listParticipantUserIds(conversation.id)).filter((userId) => userId !== viewerId);
    for (const otherUserId of others) {
      if (await this.dependencies.socialGraph.isBlockedEitherWay(viewerId, otherUserId)) throw forbidden("You cannot message this user.");
    }
  }

  public async listAudienceUserIds(conversation: ConversationRecord): Promise<readonly string[]> {
    const participantIds = await this.dependencies.conversations.listParticipantUserIds(conversation.id);
    if (conversation.kind !== "business" || conversation.storeId === null) return participantIds;
    const [store] = await this.dependencies.storeAccess.findStoreSummaries([conversation.storeId]);
    return [...new Set([...participantIds, ...(store === undefined ? [] : [store.ownerId])])];
  }

  public buildVoiceNoteUrl(conversationId: string, messageId: string): string {
    return `${this.dependencies.settings.publicBaseUrl}/api/v1/conversations/${conversationId}/messages/${messageId}/voice`;
  }

  public async findPhotoUrls(mediaIds: readonly (string | null)[]): Promise<ReadonlyMap<string, string | null>> {
    const wanted = mediaIds.filter((mediaId): mediaId is string => mediaId !== null);
    if (wanted.length === 0) return new Map();
    const items = await this.dependencies.mediaLibrary.findMediaByIds(wanted);
    return new Map(items.map((item) => [item.id, item.url]));
  }

  public async assertOwnedImageMedia(mediaId: string, ownerId: string): Promise<void> {
    const [item] = await this.dependencies.mediaLibrary.findMediaByIds([mediaId]);
    if (item === undefined || item.ownerId !== ownerId || item.type !== "image" || item.status === "failed") throw notFound("Photo");
  }
}
