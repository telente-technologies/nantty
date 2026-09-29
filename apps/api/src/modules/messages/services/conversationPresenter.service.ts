import type { StoreSummary } from "../../../interfaces/storeAccess.interface.js";
import type { UserSummary } from "../../../interfaces/userDirectory.interface.js";
import { describeMessagePreview, type ConversationDto, type FriendshipDto, type ViewerConversationRole } from "../dtos/messages.dto.js";
import type { ConversationRecord, ParticipantRecord } from "../models/messages.model.js";
import { convertStoreToIdentity, type MessagePresenter } from "./messagePresenter.service.js";
import type { MessagesService } from "./messages.service.js";

const NO_FRIENDSHIP: FriendshipDto = { following: false, followedBy: false, areFriends: false };
const PEER_CANDIDATE_LIMIT = 3;

export class ConversationPresenter {
  public constructor(private readonly messagesService: MessagesService, private readonly messagePresenter: MessagePresenter) {}

  public async describeFriendship(userId: string, otherUserId: string | undefined): Promise<FriendshipDto> {
    if (otherUserId === undefined) return NO_FRIENDSHIP;
    const { socialGraph } = this.messagesService.dependencies;
    const [following, followedBy] = await Promise.all([socialGraph.isFollowingUser(userId, otherUserId), socialGraph.isFollowingUser(otherUserId, userId)]);
    return { following, followedBy, areFriends: following && followedBy };
  }

  public async presentConversations(conversations: readonly ConversationRecord[], viewerId: string): Promise<readonly ConversationDto[]> {
    const { storeAccess } = this.messagesService.dependencies;
    const storeIds = [...new Set(conversations.map((conversation) => conversation.storeId).filter((storeId): storeId is string => storeId !== null))];
    const [stores, photoUrls] = await Promise.all([
      storeIds.length === 0 ? Promise.resolve([]) : storeAccess.findStoreSummaries(storeIds),
      this.messagesService.findPhotoUrls(conversations.map((conversation) => conversation.photoMediaId)),
    ]);
    const storesById = new Map(stores.map((store) => [store.id, store]));
    return Promise.all(
      conversations.map((conversation) =>
        this.presentConversation(conversation, viewerId, conversation.storeId === null ? undefined : storesById.get(conversation.storeId), photoUrls),
      ),
    );
  }

  public async presentConversation(
    conversation: ConversationRecord,
    viewerId: string,
    store: StoreSummary | undefined,
    photoUrls: ReadonlyMap<string, string | null>,
  ): Promise<ConversationDto> {
    const { conversations, messages, userDirectory, clock } = this.messagesService.dependencies;
    const now = clock.now();
    const [participant, candidates, latest] = await Promise.all([
      conversations.findParticipant(conversation.id, viewerId),
      conversations.listParticipants(conversation.id, PEER_CANDIDATE_LIMIT),
      messages.findLatestVisibleMessage(conversation.id, now),
    ]);
    const peerId = this.choosePeerId(conversation, viewerId, participant, candidates, store);
    const [peerSummaries, unread, friendship, latestMessages] = await Promise.all([
      peerId === undefined ? Promise.resolve([] as readonly UserSummary[]) : userDirectory.findUserSummaries([peerId]),
      participant === undefined ? Promise.resolve(0) : messages.countUnreadMessages(conversation.id, viewerId, participant.lastReadAt, now),
      conversation.kind === "direct" ? this.describeFriendship(viewerId, peerId) : Promise.resolve(NO_FRIENDSHIP),
      latest === undefined ? Promise.resolve([]) : this.messagePresenter.presentMessages([latest], viewerId),
    ]);
    const peer = peerSummaries[0] ?? null;
    const storeIdentity = store === undefined ? null : convertStoreToIdentity(store);
    return {
      id: conversation.id,
      kind: conversation.kind,
      peer,
      lastMessage: latest === undefined ? "" : describeMessagePreview(latest.kind, latest.text),
      lastMessageAt: conversation.lastMessageAt.toISOString(),
      unread,
      isFriend: friendship.areFriends,
      title: conversation.title,
      description: conversation.description,
      photoUrl: conversation.photoMediaId === null ? (storeIdentity?.logoUrl ?? null) : (photoUrls.get(conversation.photoMediaId) ?? null),
      memberCount: conversation.memberCount,
      subscriberCount: conversation.kind === "channel" ? conversation.memberCount : 0,
      myRole: this.describeViewerRole(participant),
      disappearingMessagesSeconds: conversation.disappearingMessagesSeconds,
      store: storeIdentity,
      otherParticipant: peer,
      unreadCount: unread,
      friendship,
      latestMessage: latestMessages[0] ?? null,
    };
  }

  private choosePeerId(
    conversation: ConversationRecord,
    viewerId: string,
    participant: ParticipantRecord | undefined,
    candidates: readonly ParticipantRecord[],
    store: StoreSummary | undefined,
  ): string | undefined {
    if (conversation.kind === "channel") return conversation.ownerId ?? undefined;
    if (conversation.kind === "business") {
      if (participant?.role === "customer") return store?.ownerId;
      return candidates.find((candidate) => candidate.role === "customer")?.userId;
    }
    return candidates.find((candidate) => candidate.userId !== viewerId)?.userId ?? (conversation.kind === "group" ? viewerId : undefined);
  }

  private describeViewerRole(participant: ParticipantRecord | undefined): ViewerConversationRole {
    if (participant === undefined || participant.role === "customer") return "member";
    return participant.role;
  }
}
