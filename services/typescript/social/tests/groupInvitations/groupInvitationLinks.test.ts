import { afterEach, describe, expect, it, vi } from "vitest";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import { conversationRepository } from "../../src/modules/conversations/repositories/conversation.repository.js";
import { blockRepository } from "../../src/modules/blocks/repositories/block.repository.js";
import { groupInvitationRepository } from "../../src/modules/groupInvitations/repositories/groupInvitation.repository.js";
import { groupInvitationLinkRepository } from "../../src/modules/groupInvitations/repositories/groupInvitationLink.repository.js";
import { createGroupInvitationLinkHandler } from "../../src/modules/groupInvitations/commands/createGroupInvitationLink/createGroupInvitationLink.handler.js";
import { claimGroupInvitationLinkHandler } from "../../src/modules/groupInvitations/commands/claimGroupInvitationLink/claimGroupInvitationLink.handler.js";
import { previewGroupInvitationLinkHandler } from "../../src/modules/groupInvitations/commands/previewGroupInvitationLink/previewGroupInvitationLink.handler.js";
import { revokeGroupInvitationLinkHandler } from "../../src/modules/groupInvitations/commands/revokeGroupInvitationLink/revokeGroupInvitationLink.handler.js";
import { createGroupInvitationLinkToken, hashGroupInvitationLinkToken, isGroupInvitationLinkToken } from "../../src/modules/groupInvitations/services/groupInvitationLinkToken.service.js";

const ownerId = "01a12b3d-d5cc-7e11-bc61-000000000001";
const inviteeId = "01a12b3d-d5cc-7e11-bc61-000000000002";
const conversationId = "01a12b3d-d5cc-7e11-bc61-000000000003";
const linkId = "01a12b3d-d5cc-7e11-bc61-000000000004";
const invitationId = "01a12b3d-d5cc-7e11-bc61-000000000005";
const now = new Date("2026-11-06T12:00:00.000Z");
const token = createGroupInvitationLinkToken();

afterEach(() => vi.restoreAllMocks());

function contextWithDatabase(client: Record<string, unknown>): HandlerContext {
  return {
    database: { client, transaction: async (work: (transaction: never) => Promise<unknown>) => work(client as never) },
    clock: { now: () => now },
    directory: { findUserSummaries: async () => new Map([[ownerId, { id: ownerId, name: "Owner", username: "owner", avatarUrl: null, verified: false, isCreator: false }]]) },
  } as unknown as HandlerContext;
}

const group = (overrides: Record<string, unknown> = {}) => ({
  id: conversationId,
  kind: "group",
  title: "Book club",
  members: [{ conversationId, accountId: ownerId, role: "owner", leftAt: null }],
  ...overrides,
});

describe("shareable E2EE group invitation links", () => {
  it("generates opaque unguessable-format tokens and stores only a one-way hash", () => {
    const rawToken = createGroupInvitationLinkToken();
    expect(isGroupInvitationLinkToken(rawToken)).toBe(true);
    expect(hashGroupInvitationLinkToken(rawToken)).toHaveLength(64);
    expect(hashGroupInvitationLinkToken(rawToken)).not.toBe(rawToken);
    expect(hashGroupInvitationLinkToken(rawToken)).toBe(hashGroupInvitationLinkToken(rawToken));
    expect(isGroupInvitationLinkToken("short-token")).toBe(false);
  });

  it("creates a bounded link only for an active group admin and persists no raw token", async () => {
    vi.spyOn(conversationRepository, "findById").mockResolvedValue(group() as never);
    const create = vi.spyOn(groupInvitationLinkRepository, "create").mockImplementation((async (_db: unknown, data: { readonly tokenHash?: string; readonly expiresAt?: Date }) => ({
      id: linkId, conversationId, createdById: ownerId, tokenHash: data.tokenHash!, createdAt: now,
      expiresAt: data.expiresAt as Date, revokedAt: null,
    })) as never);
    const handler = createGroupInvitationLinkHandler(contextWithDatabase({}));
    const result = await handler({ actorId: ownerId, conversationId, expiresInHours: 24 });
    const stored = create.mock.calls[0]?.[1];

    expect(isGroupInvitationLinkToken(result.token)).toBe(true);
    expect(stored?.tokenHash).toBe(hashGroupInvitationLinkToken(result.token));
    expect(stored).not.toHaveProperty("token");
    expect(new Date(result.expiresAt).getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000);

    vi.spyOn(conversationRepository, "findById").mockResolvedValue(group({ members: [{ conversationId, accountId: inviteeId, role: "member", leftAt: null }] }) as never);
    const unauthorized = createGroupInvitationLinkHandler(contextWithDatabase({}));
    await expect(unauthorized({ actorId: inviteeId, conversationId, expiresInHours: 168 })).rejects.toMatchObject({ status: 403, code: "NOT_GROUP_ADMIN" });
  });

  it("exposes only safe group metadata on preview and hides expired or revoked links", async () => {
    vi.spyOn(groupInvitationLinkRepository, "findActiveByTokenHash").mockResolvedValue({
      id: linkId, conversationId, createdById: ownerId, tokenHash: hashGroupInvitationLinkToken(token),
      createdAt: now, expiresAt: new Date(now.getTime() + 60_000), revokedAt: null,
      conversation: group({ description: "must not leak", encryptedAttributes: "ciphertext" }),
    } as never);
    const handler = previewGroupInvitationLinkHandler(contextWithDatabase({}));
    const preview = await handler({ token });
    expect(preview).toEqual({ group: { title: "Book club", memberCount: 1 }, expiresAt: new Date(now.getTime() + 60_000).toISOString() });
    expect(JSON.stringify(preview)).not.toContain("ciphertext");
    expect(JSON.stringify(preview)).not.toContain("description");

    vi.spyOn(groupInvitationLinkRepository, "findActiveByTokenHash").mockReturnValue(Promise.resolve(null) as never);
    await expect(handler({ token })).rejects.toMatchObject({ status: 404, code: "GROUP_INVITATION_LINK_NOT_FOUND" });
  });

  it("claim creates a pending invitation only, and does not add membership or expose keys/history", async () => {
    const linkedGroup = group();
    vi.spyOn(groupInvitationLinkRepository, "findActiveByTokenHash").mockResolvedValue({
      id: linkId, conversationId, createdById: ownerId, tokenHash: hashGroupInvitationLinkToken(token),
      createdAt: now, expiresAt: new Date(now.getTime() + 86_400_000), revokedAt: null, conversation: linkedGroup,
    } as never);
    vi.spyOn(blockRepository, "hasBlockedPairWithAny").mockResolvedValue(false);
    vi.spyOn(groupInvitationRepository, "updatePendingForPair").mockResolvedValue({ count: 0 } as never);
    vi.spyOn(groupInvitationRepository, "findPair").mockResolvedValue(null);
    vi.spyOn(groupInvitationRepository, "countOpenForConversation").mockResolvedValue(0);
    const pending = {
      id: invitationId, conversationId, inviterId: ownerId, inviteeId, status: "pending",
      createdAt: now, expiresAt: new Date(now.getTime() + 86_400_000), respondedAt: null, updatedAt: now,
    };
    vi.spyOn(groupInvitationRepository, "create").mockResolvedValue(pending as never);
    const memberCreate = vi.fn();
    const memberUpsert = vi.fn();
    const db = { conversationMember: { create: memberCreate, upsert: memberUpsert }, outboxEvent: { createMany: vi.fn(async () => ({ count: 1 })) } };
    const handler = claimGroupInvitationLinkHandler(contextWithDatabase(db));
    const result = await handler({ inviteeId, token });

    expect(result).toMatchObject({ id: invitationId, status: "pending", membershipStatus: "not_joined" });
    expect(memberCreate).not.toHaveBeenCalled();
    expect(memberUpsert).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/history|ciphertext|key/i);
  });

  it("cannot preview or claim revoked/expired links and requires current admin authority to revoke", async () => {
    vi.spyOn(conversationRepository, "findById").mockResolvedValue(group() as never);
    vi.spyOn(groupInvitationLinkRepository, "findActiveByTokenHash").mockReturnValue(Promise.resolve(null) as never);
    await expect(previewGroupInvitationLinkHandler(contextWithDatabase({}))({ token })).rejects.toMatchObject({ status: 404 });
    await expect(claimGroupInvitationLinkHandler(contextWithDatabase({}))({ inviteeId, token })).rejects.toMatchObject({ status: 404 });

    vi.spyOn(conversationRepository, "findById").mockResolvedValue(group({ members: [{ conversationId, accountId: inviteeId, role: "member", leftAt: null }] }) as never);
    const revoke = revokeGroupInvitationLinkHandler(contextWithDatabase({}));
    await expect(revoke({ actorId: inviteeId, conversationId, linkId })).rejects.toMatchObject({ status: 403, code: "NOT_GROUP_ADMIN" });
  });

  it("never treats channel subscriptions as group invitations or links", async () => {
    vi.spyOn(conversationRepository, "findById").mockResolvedValue(group({ kind: "channel" }) as never);
    const channelContext = contextWithDatabase({});
    await expect(createGroupInvitationLinkHandler(channelContext)({ actorId: ownerId, conversationId, expiresInHours: 168 })).rejects.toMatchObject({ status: 403, code: "NOT_A_GROUP" });
    await expect(revokeGroupInvitationLinkHandler(channelContext)({ actorId: ownerId, conversationId, linkId })).rejects.toMatchObject({ status: 403, code: "NOT_A_GROUP" });

    vi.spyOn(groupInvitationLinkRepository, "findActiveByTokenHash").mockResolvedValue({
      id: linkId, conversationId, createdById: ownerId, tokenHash: hashGroupInvitationLinkToken(token),
      createdAt: now, expiresAt: new Date(now.getTime() + 60_000), revokedAt: null,
      conversation: group({ kind: "channel" }),
    } as never);
    await expect(claimGroupInvitationLinkHandler(channelContext)({ inviteeId, token })).rejects.toMatchObject({ status: 404, code: "GROUP_INVITATION_LINK_NOT_FOUND" });
  });
});
