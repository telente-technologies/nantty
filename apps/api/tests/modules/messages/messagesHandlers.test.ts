import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { NotificationRequestedEvent, type NotificationRequestedPayload } from "../../../src/events/notificationRequested.event.js";
import type { Principal } from "../../../src/interfaces/principal.interface.js";
import type { SocialGraph } from "../../../src/interfaces/socialGraph.interface.js";
import type { UserContact, UserDirectory, UserLocalePreference, UserSummary } from "../../../src/interfaces/userDirectory.interface.js";
import { createCore } from "../../../src/loaders/core.loader.js";
import { subscribeToEvent } from "../../../src/loaders/events.loader.js";
import { SendMessageCommand } from "../../../src/modules/messages/commands/sendMessage/sendMessage.command.js";
import { StartConversationCommand } from "../../../src/modules/messages/commands/startConversation/startConversation.command.js";
import type { ConversationSummaryDto } from "../../../src/modules/messages/dtos/messages.dto.js";
import { registerMessagesCommandAndQueryHandlers } from "../../../src/modules/messages/messages.module.js";
import type { MessageRecord } from "../../../src/modules/messages/models/messages.model.js";
import { GetUnreadMessageCountQuery } from "../../../src/modules/messages/queries/getUnreadMessageCount/getUnreadMessageCount.query.js";
import type { UnreadMessageCounts } from "../../../src/modules/messages/queries/getUnreadMessageCount/getUnreadMessageCount.handler.js";
import { ListMessagesQuery } from "../../../src/modules/messages/queries/listMessages/listMessages.query.js";
import { InMemoryMessagesRepository } from "../../../src/modules/messages/repositories/messages.repository.js";
import { MessagesService } from "../../../src/modules/messages/services/messages.service.js";
import type { Page } from "../../../src/types/pagination.type.js";
import { AdjustableClock, createTestSettings } from "../../fixtures/testApplication.fixture.js";

class FakeSocialGraph implements SocialGraph {
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

class FakeUserDirectory implements UserDirectory {
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

function createMessagingEnvironment() {
  const clock = new AdjustableClock();
  const core = createCore({ settings: createTestSettings(), persistence: "memory", clock });
  const socialGraph = new FakeSocialGraph();
  const userDirectory = new FakeUserDirectory();
  registerMessagesCommandAndQueryHandlers(
    core.commands,
    core.queries,
    new MessagesService({ messages: new InMemoryMessagesRepository(), userDirectory, socialGraph, events: core.events, clock }),
  );
  const requested: NotificationRequestedPayload[] = [];
  subscribeToEvent(core.events, NotificationRequestedEvent, (payload) => {
    requested.push(payload);
  });
  const createPrincipal = (name: string): Principal => {
    const userId = randomUUID();
    userDirectory.users.set(userId, { id: userId, username: name, name, avatarUrl: null, isSeller: false });
    return { userId, roles: ["buyer"], sessionId: randomUUID() };
  };
  return { core, clock, socialGraph, requested, createPrincipal };
}

describe("messaging handlers", () => {
  it("reuses one direct conversation per pair and notifies the recipient", async () => {
    const { core, clock, requested, createPrincipal } = createMessagingEnvironment();
    const ada = createPrincipal("ada");
    const bola = createPrincipal("bola");
    const first = await core.commands.execute<StartConversationCommand, ConversationSummaryDto>(new StartConversationCommand(ada, bola.userId));
    const second = await core.commands.execute<StartConversationCommand, ConversationSummaryDto>(new StartConversationCommand(bola, ada.userId));
    expect(second.id).toBe(first.id);
    expect(first.friendship).toEqual({ following: false, followedBy: false, areFriends: false });

    clock.advanceBySeconds(1);
    await core.commands.execute<SendMessageCommand, MessageRecord>(new SendMessageCommand(ada, first.id, { text: "Is this still available?" }));
    expect(requested).toEqual([expect.objectContaining({ userId: bola.userId, category: "messages" })]);
    const unread = await core.queries.execute<GetUnreadMessageCountQuery, UnreadMessageCounts>(new GetUnreadMessageCountQuery(bola));
    expect(unread).toEqual({ total: 1, conversationsWithUnread: 1 });
  });

  it("refuses conversations and messages between blocked users", async () => {
    const { core, socialGraph, createPrincipal } = createMessagingEnvironment();
    const ada = createPrincipal("ada");
    const bola = createPrincipal("bola");
    const conversation = await core.commands.execute<StartConversationCommand, ConversationSummaryDto>(new StartConversationCommand(ada, bola.userId));
    socialGraph.blocks.add(`${bola.userId}:${ada.userId}`);
    await expect(core.commands.execute(new StartConversationCommand(ada, bola.userId))).rejects.toMatchObject({ statusCode: 403 });
    await expect(core.commands.execute(new SendMessageCommand(ada, conversation.id, { text: "hello" }))).rejects.toMatchObject({ statusCode: 403 });
  });

  it("hides conversations from non-participants", async () => {
    const { core, createPrincipal } = createMessagingEnvironment();
    const ada = createPrincipal("ada");
    const bola = createPrincipal("bola");
    const eve = createPrincipal("eve");
    const conversation = await core.commands.execute<StartConversationCommand, ConversationSummaryDto>(new StartConversationCommand(ada, bola.userId));
    await expect(core.commands.execute(new SendMessageCommand(eve, conversation.id, { text: "hi" }))).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      core.queries.execute<ListMessagesQuery, Page<MessageRecord>>(new ListMessagesQuery(eve, conversation.id, { limit: 10 })),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
