import { describe, expect, it } from "vitest";

import { NotificationRequestedEvent, type NotificationRequestedPayload } from "../../../src/events/notificationRequested.event.js";
import { subscribeToEvent } from "../../../src/loaders/events.loader.js";
import { SendMessageCommand } from "../../../src/modules/messages/commands/sendMessage/sendMessage.command.js";
import { StartConversationCommand } from "../../../src/modules/messages/commands/startConversation/startConversation.command.js";
import type { ConversationDto, MessageDto } from "../../../src/modules/messages/dtos/messages.dto.js";
import { GetUnreadMessageCountQuery } from "../../../src/modules/messages/queries/getUnreadMessageCount/getUnreadMessageCount.query.js";
import type { UnreadMessageCounts } from "../../../src/modules/messages/queries/getUnreadMessageCount/getUnreadMessageCount.handler.js";
import { ListMessagesQuery } from "../../../src/modules/messages/queries/listMessages/listMessages.query.js";
import type { Page } from "../../../src/types/pagination.type.js";
import { createMessagingEnvironment as createBaseEnvironment } from "./messagingFakes.fixture.js";

function createMessagingEnvironment() {
  const environment = createBaseEnvironment();
  const requested: NotificationRequestedPayload[] = [];
  subscribeToEvent(environment.core.events, NotificationRequestedEvent, (payload) => {
    requested.push(payload);
  });
  return { ...environment, requested };
}

describe("messaging handlers", () => {
  it("reuses one direct conversation per pair and notifies the recipient", async () => {
    const { core, clock, requested, createPrincipal } = createMessagingEnvironment();
    const ada = createPrincipal("ada");
    const bola = createPrincipal("bola");
    const first = await core.commands.execute<StartConversationCommand, ConversationDto>(new StartConversationCommand(ada, bola.userId));
    const second = await core.commands.execute<StartConversationCommand, ConversationDto>(new StartConversationCommand(bola, ada.userId));
    expect(second.id).toBe(first.id);
    expect(first.friendship).toEqual({ following: false, followedBy: false, areFriends: false });

    clock.advanceBySeconds(1);
    await core.commands.execute<SendMessageCommand, MessageDto>(new SendMessageCommand(ada, first.id, { text: "Is this still available?" }));
    expect(requested).toEqual([expect.objectContaining({ userId: bola.userId, category: "messages" })]);
    const unread = await core.queries.execute<GetUnreadMessageCountQuery, UnreadMessageCounts>(new GetUnreadMessageCountQuery(bola));
    expect(unread).toEqual({ total: 1, conversationsWithUnread: 1 });
  });

  it("refuses conversations and messages between blocked users", async () => {
    const { core, socialGraph, createPrincipal } = createMessagingEnvironment();
    const ada = createPrincipal("ada");
    const bola = createPrincipal("bola");
    const conversation = await core.commands.execute<StartConversationCommand, ConversationDto>(new StartConversationCommand(ada, bola.userId));
    socialGraph.blocks.add(`${bola.userId}:${ada.userId}`);
    await expect(core.commands.execute(new StartConversationCommand(ada, bola.userId))).rejects.toMatchObject({ statusCode: 403 });
    await expect(core.commands.execute(new SendMessageCommand(ada, conversation.id, { text: "hello" }))).rejects.toMatchObject({ statusCode: 403 });
  });

  it("hides conversations from non-participants", async () => {
    const { core, createPrincipal } = createMessagingEnvironment();
    const ada = createPrincipal("ada");
    const bola = createPrincipal("bola");
    const eve = createPrincipal("eve");
    const conversation = await core.commands.execute<StartConversationCommand, ConversationDto>(new StartConversationCommand(ada, bola.userId));
    await expect(core.commands.execute(new SendMessageCommand(eve, conversation.id, { text: "hi" }))).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      core.queries.execute<ListMessagesQuery, Page<MessageDto>>(new ListMessagesQuery(eve, conversation.id, { limit: 10 }, undefined)),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
