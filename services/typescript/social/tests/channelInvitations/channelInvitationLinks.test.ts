import { afterEach, describe, expect, it, vi } from "vitest";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import { conversationRepository } from "../../src/modules/conversations/repositories/conversation.repository.js";
import { blockRepository } from "../../src/modules/blocks/repositories/block.repository.js";
import { channelInvitationRepository } from "../../src/modules/channelInvitations/repositories/channelInvitation.repository.js";
import { channelInvitationLinkRepository } from "../../src/modules/channelInvitations/repositories/channelInvitationLink.repository.js";
import { createChannelInvitationLinkHandler } from "../../src/modules/channelInvitations/commands/createChannelInvitationLink/createChannelInvitationLink.handler.js";
import { previewChannelInvitationLinkHandler } from "../../src/modules/channelInvitations/commands/previewChannelInvitationLink/previewChannelInvitationLink.handler.js";
import { claimChannelInvitationLinkHandler } from "../../src/modules/channelInvitations/commands/claimChannelInvitationLink/claimChannelInvitationLink.handler.js";
import { acceptChannelInvitationHandler } from "../../src/modules/channelInvitations/commands/acceptChannelInvitation/acceptChannelInvitation.handler.js";
import { declineChannelInvitationHandler } from "../../src/modules/channelInvitations/commands/declineChannelInvitation/declineChannelInvitation.handler.js";
import { listChannelInvitationLinksHandler } from "../../src/modules/channelInvitations/queries/listChannelInvitationLinks/listChannelInvitationLinks.handler.js";
import { revokeChannelInvitationLinkHandler } from "../../src/modules/channelInvitations/commands/revokeChannelInvitationLink/revokeChannelInvitationLink.handler.js";
import { createChannelInvitationLinkToken, hashChannelInvitationLinkToken, isChannelInvitationLinkToken } from "../../src/modules/channelInvitations/services/channelInvitationLinkToken.service.js";

const ownerId = "01a12b3d-d5cc-7e11-bc61-000000000001";
const inviteeId = "01a12b3d-d5cc-7e11-bc61-000000000002";
const channelId = "01a12b3d-d5cc-7e11-bc61-000000000003";
const linkId = "01a12b3d-d5cc-7e11-bc61-000000000004";
const invitationId = "01a12b3d-d5cc-7e11-bc61-000000000005";
const now = new Date("2026-11-06T12:00:00.000Z");
const token = createChannelInvitationLinkToken();

afterEach(() => vi.restoreAllMocks());

function contextWithDatabase(client: Record<string, unknown>): HandlerContext {
  return {
    database: { client, transaction: async (work: (transaction: never) => Promise<unknown>) => work(client as never) },
    clock: { now: () => now },
  } as unknown as HandlerContext;
}

const channel = (overrides: Record<string, unknown> = {}) => ({
  id: channelId,
  kind: "channel",
  title: "Studio updates",
  createdById: ownerId,
  members: [{ conversationId: channelId, accountId: ownerId, role: "owner", leftAt: null }],
  ...overrides,
});

const invitation = (overrides: Record<string, unknown> = {}) => ({
  id: invitationId,
  conversationId: channelId,
  inviterId: ownerId,
  inviteeId,
  status: "pending",
  createdAt: now,
  expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  respondedAt: null,
  conversation: { id: channelId, kind: "channel", title: "Studio updates" },
  ...overrides,
});

describe("channel shareable invitation links", () => {
  it("uses an opaque token and persists only its hash; create is owner/admin-only", async () => {
    expect(isChannelInvitationLinkToken(token)).toBe(true);
    expect(hashChannelInvitationLinkToken(token)).toHaveLength(64);
    expect(hashChannelInvitationLinkToken(token)).not.toBe(token);

    vi.spyOn(conversationRepository, "findById").mockResolvedValue(channel() as never);
    const create = vi.spyOn(channelInvitationLinkRepository, "create").mockImplementation((async (_db: unknown, data: Record<string, unknown>) => ({
      id: linkId, conversationId: channelId, createdAt: now, revokedAt: null, ...data,
    })) as never);
    const result = await createChannelInvitationLinkHandler(contextWithDatabase({}))({ actorId: ownerId, channelId, expiresInHours: 24 });
    expect(create.mock.calls[0]?.[1]).toMatchObject({ tokenHash: hashChannelInvitationLinkToken(result.token) });
    expect(create.mock.calls[0]?.[1]).not.toHaveProperty("token");
    expect(result.expiresAt).toBe(new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString());

    vi.spyOn(conversationRepository, "findById").mockResolvedValue(channel({ members: [{ accountId: inviteeId, role: "subscriber", leftAt: null }] }) as never);
    await expect(createChannelInvitationLinkHandler(contextWithDatabase({}))({ actorId: inviteeId, channelId, expiresInHours: 168 }))
      .rejects.toMatchObject({ status: 403, code: "NOT_CHANNEL_ADMIN" });
  });

  it("previews only non-sensitive channel details and rejects unavailable tokens", async () => {
    vi.spyOn(channelInvitationLinkRepository, "findActiveByTokenHash").mockResolvedValue({
      id: linkId, conversationId: channelId, createdById: ownerId, tokenHash: hashChannelInvitationLinkToken(token),
      createdAt: now, expiresAt: new Date(now.getTime() + 60_000), revokedAt: null,
      conversation: channel({ description: "private description", encryptedAttributes: "secret" }),
    } as never);
    const preview = await previewChannelInvitationLinkHandler(contextWithDatabase({}))({ token });
    expect(preview).toEqual({ channel: { title: "Studio updates", subscriberCount: 1 }, expiresAt: new Date(now.getTime() + 60_000).toISOString() });
    expect(JSON.stringify(preview)).not.toMatch(/private description|secret/);

    vi.spyOn(channelInvitationLinkRepository, "findActiveByTokenHash").mockResolvedValue(null as never);
    await expect(previewChannelInvitationLinkHandler(contextWithDatabase({}))({ token }))
      .rejects.toMatchObject({ status: 404, code: "CHANNEL_INVITATION_LINK_NOT_FOUND" });
  });

  it("claim creates only a pending invitation, is repeat-safe, and never subscribes", async () => {
    vi.spyOn(channelInvitationLinkRepository, "findActiveByTokenHash").mockResolvedValue({
      id: linkId, conversationId: channelId, createdById: ownerId, tokenHash: hashChannelInvitationLinkToken(token),
      createdAt: now, expiresAt: new Date(now.getTime() + 86_400_000), revokedAt: null, conversation: channel(),
    } as never);
    vi.spyOn(blockRepository, "eitherDirection").mockResolvedValue(false);
    vi.spyOn(channelInvitationRepository, "expirePendingForPair").mockResolvedValue({ count: 0 } as never);
    vi.spyOn(channelInvitationRepository, "findPair").mockResolvedValue(null as never);
    vi.spyOn(channelInvitationRepository, "create").mockResolvedValue(invitation() as never);
    vi.spyOn(channelInvitationRepository, "findById").mockResolvedValue(invitation() as never);
    const memberUpsert = vi.fn();
    const context = contextWithDatabase({ conversationMember: { upsert: memberUpsert }, outboxEvent: { createMany: vi.fn(async () => ({ count: 1 })) } });
    const result = await claimChannelInvitationLinkHandler(context)({ inviteeId, token });
    expect(result).toMatchObject({ id: invitationId, status: "pending", channelId, inviteeId });
    expect(memberUpsert).not.toHaveBeenCalled();
    expect(channelInvitationRepository.create).toHaveBeenCalledTimes(1);

    vi.spyOn(channelInvitationRepository, "findPair").mockResolvedValue(invitation() as never);
    const repeat = await claimChannelInvitationLinkHandler(context)({ inviteeId, token });
    expect(repeat.id).toBe(invitationId);
    expect(channelInvitationRepository.create).toHaveBeenCalledTimes(1);
  });

  it("accepts transactionally before making the invitee a subscriber; acceptance is idempotent", async () => {
    vi.spyOn(channelInvitationRepository, "findById").mockResolvedValueOnce(invitation() as never).mockResolvedValueOnce(invitation({ status: "accepted" }) as never);
    const settle = vi.spyOn(channelInvitationRepository, "settlePending").mockResolvedValue({ count: 1 } as never);
    const memberUpsert = vi.fn(async () => ({}));
    const outbox = vi.fn(async () => ({ count: 1 }));
    const transaction = { channelInvitation: {}, conversationMember: { upsert: memberUpsert }, outboxEvent: { createMany: outbox } };
    const handler = acceptChannelInvitationHandler(contextWithDatabase(transaction));
    const result = await handler({ inviteeId, invitationId });
    expect(result.status).toBe("accepted");
    expect(settle).toHaveBeenCalledWith(transaction, invitationId, inviteeId, "accepted", now);
    expect(memberUpsert).toHaveBeenCalledWith({
      where: { conversationId_accountId: { conversationId: channelId, accountId: inviteeId } },
      create: { conversationId: channelId, accountId: inviteeId, role: "subscriber", inboxFolder: "chats" },
      update: { leftAt: null, role: "subscriber", inboxFolder: "chats" },
    });
    expect(outbox).toHaveBeenCalledTimes(1);

    vi.spyOn(channelInvitationRepository, "findById").mockResolvedValue(invitation({ status: "accepted" }) as never);
    const repeated = await handler({ inviteeId, invitationId });
    expect(repeated.status).toBe("accepted");
    expect(memberUpsert).toHaveBeenCalledTimes(1);
  });

  it("declines without subscribing and restricts link-list/revocation to channel admins", async () => {
    const pending = invitation();
    vi.spyOn(channelInvitationRepository, "findById").mockResolvedValueOnce(pending as never).mockResolvedValueOnce(invitation({ status: "declined" }) as never);
    vi.spyOn(channelInvitationRepository, "settlePending").mockResolvedValue({ count: 1 } as never);
    const memberUpsert = vi.fn();
    const outbox = { createMany: vi.fn(async () => ({ count: 1 })) };
    await declineChannelInvitationHandler(contextWithDatabase({ channelInvitation: {}, conversationMember: { upsert: memberUpsert }, outboxEvent: outbox }))({ inviteeId, invitationId });
    expect(memberUpsert).not.toHaveBeenCalled();

    vi.spyOn(conversationRepository, "findById").mockResolvedValue(channel() as never);
    vi.spyOn(channelInvitationLinkRepository, "findCursorInChannel").mockResolvedValue({ id: linkId } as never);
    vi.spyOn(channelInvitationLinkRepository, "pageForChannel").mockResolvedValue([] as never);
    await expect(listChannelInvitationLinksHandler(contextWithDatabase({}))({ actorId: ownerId, channelId, limit: 20 }))
      .resolves.toEqual({ data: [], nextCursor: null });
    vi.spyOn(channelInvitationLinkRepository, "findByIdForChannel").mockResolvedValueOnce({
      id: linkId, conversationId: channelId, createdById: ownerId, tokenHash: "x", createdAt: now, expiresAt: new Date(now.getTime() + 1000), revokedAt: null,
    } as never).mockResolvedValueOnce({
      id: linkId, conversationId: channelId, createdById: ownerId, tokenHash: "x", createdAt: now, expiresAt: new Date(now.getTime() + 1000), revokedAt: now,
    } as never);
    vi.spyOn(channelInvitationLinkRepository, "revoke").mockResolvedValue({ count: 1 } as never);
    await expect(revokeChannelInvitationLinkHandler(contextWithDatabase({}))({ actorId: ownerId, channelId, linkId }))
      .resolves.toMatchObject({ id: linkId, revokedAt: expect.any(String) });

    vi.spyOn(conversationRepository, "findById").mockResolvedValue(channel({ members: [{ accountId: inviteeId, role: "subscriber", leftAt: null }] }) as never);
    await expect(listChannelInvitationLinksHandler(contextWithDatabase({}))({ actorId: inviteeId, channelId, limit: 20 }))
      .rejects.toMatchObject({ status: 403, code: "NOT_CHANNEL_ADMIN" });
    await expect(revokeChannelInvitationLinkHandler(contextWithDatabase({}))({ actorId: inviteeId, channelId, linkId }))
      .rejects.toMatchObject({ status: 403, code: "NOT_CHANNEL_ADMIN" });
  });
});
