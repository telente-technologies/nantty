import { randomUUID } from "node:crypto";

import type { MediaLibrary, MediaLibraryItem, MediaOriginalFile } from "../../../src/interfaces/mediaLibrary.interface.js";
import type { Principal } from "../../../src/interfaces/principal.interface.js";
import type { RealtimeEvent, RealtimePublisher } from "../../../src/interfaces/realtimePublisher.interface.js";
import type { SocialGraph } from "../../../src/interfaces/socialGraph.interface.js";
import type { StoreAccess, StoreSummary } from "../../../src/interfaces/storeAccess.interface.js";
import type { UserContact, UserDirectory, UserLocalePreference, UserSummary } from "../../../src/interfaces/userDirectory.interface.js";
import { createCore } from "../../../src/loaders/core.loader.js";
import { registerMessagesCommandAndQueryHandlers } from "../../../src/modules/messages/messages.module.js";
import { InMemoryConversationsRepository } from "../../../src/modules/messages/repositories/conversations.repository.js";
import { InMemoryMessagesRepository } from "../../../src/modules/messages/repositories/messages.repository.js";
import { InMemoryRealtimeTicketsRepository } from "../../../src/modules/messages/repositories/realtimeTickets.repository.js";
import { MessagesService } from "../../../src/modules/messages/services/messages.service.js";
import { RealtimeTicketService } from "../../../src/modules/messages/services/realtimeTickets.service.js";
import { AdjustableClock, createTestSettings } from "../../fixtures/testApplication.fixture.js";

export class FakeSocialGraph implements SocialGraph {
  public readonly blocks = new Set<string>();
  public readonly follows = new Set<string>();

  public async isBlockedEitherWay(userId: string, otherUserId: string): Promise<boolean> {
    return this.blocks.has(`${userId}:${otherUserId}`) || this.blocks.has(`${otherUserId}:${userId}`);
  }

  public async isFollowingUser(followerId: string, followedUserId: string): Promise<boolean> {
    return this.follows.has(`${followerId}:${followedUserId}`);
  }

  public async listFollowedUserIds(): Promise<readonly string[]> {
    return [];
  }

  public async listFollowedStoreIds(): Promise<readonly string[]> {
    return [];
  }

  public async countFollowers(): Promise<number> {
    return 0;
  }
}

export class FakeUserDirectory implements UserDirectory {
  public readonly users = new Map<string, UserSummary>();

  public async findUserSummaries(userIds: readonly string[]): Promise<readonly UserSummary[]> {
    return userIds.map((id) => this.users.get(id)).filter((user): user is UserSummary => user !== undefined);
  }

  public async findUserContact(): Promise<UserContact | undefined> {
    return undefined;
  }

  public async findUserLocalePreference(): Promise<UserLocalePreference | undefined> {
    return undefined;
  }

  public async findTopicSlugById(): Promise<string | undefined> {
    return undefined;
  }

  public async searchUsers(): Promise<readonly UserSummary[]> {
    return [];
  }

  public async grantRole(): Promise<void> {}

  public async listSelectedTopicSlugs(): Promise<readonly string[]> {
    return [];
  }
}

export class EmptyStoreAccess implements StoreAccess {
  public async assertStoreMember(): Promise<void> {
    throw new Error("not a member");
  }

  public async listStoreIdsForMember(): Promise<readonly string[]> {
    return [];
  }

  public async findPrimaryStoreIdForMember(): Promise<string | undefined> {
    return undefined;
  }

  public async findStoreSummaries(): Promise<readonly StoreSummary[]> {
    return [];
  }

  public async updateStoreRating(): Promise<void> {}
}

export class EmptyMediaLibrary implements MediaLibrary {
  public async findMediaByIds(): Promise<readonly MediaLibraryItem[]> {
    return [];
  }

  public async readMediaOriginal(): Promise<MediaOriginalFile | undefined> {
    return undefined;
  }
}

export class RecordingRealtimePublisher implements RealtimePublisher {
  public readonly delivered: { readonly userId: string; readonly event: RealtimeEvent }[] = [];

  public publishToUser(userId: string, event: RealtimeEvent): void {
    this.delivered.push({ userId, event });
  }

  public disconnectUser(): void {}
}

export function createMessagingEnvironment() {
  const clock = new AdjustableClock();
  const core = createCore({ settings: createTestSettings(), persistence: "memory", clock });
  const socialGraph = new FakeSocialGraph();
  const userDirectory = new FakeUserDirectory();
  const realtime = new RecordingRealtimePublisher();
  const messagesService = new MessagesService({
    conversations: new InMemoryConversationsRepository(),
    messages: new InMemoryMessagesRepository(),
    userDirectory,
    socialGraph,
    storeAccess: new EmptyStoreAccess(),
    mediaLibrary: new EmptyMediaLibrary(),
    realtime,
    events: core.events,
    clock,
    settings: { publicBaseUrl: "", maximumGroupMembers: 8 },
  });
  const tickets = new RealtimeTicketService(new InMemoryRealtimeTicketsRepository(), clock, 30);
  registerMessagesCommandAndQueryHandlers(core.commands, core.queries, messagesService, tickets);
  const createPrincipal = (name: string): Principal => {
    const userId = randomUUID();
    userDirectory.users.set(userId, { id: userId, username: name, name, avatarUrl: null, isSeller: false });
    return { userId, roles: ["buyer"], sessionId: randomUUID() };
  };
  return { core, clock, socialGraph, realtime, tickets, messagesService, createPrincipal };
}
