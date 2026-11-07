jest.mock("../core/apiClient.service", () => ({
  api: { get: jest.fn(), getPage: jest.fn(), post: jest.fn(), delete: jest.fn() },
  generateIdempotencyKey: jest.fn(() => "group-invitation-key"),
}));
jest.mock("../chat/messages.service", () => ({ sendChatControl: jest.fn() }));
jest.mock("../chat/groupDetails.service", () => ({ withDecryptedGroupDetails: jest.fn() }));
jest.mock("../chatCrypto/chatCrypto.service", () => ({ chatCryptoService: {} }));
jest.mock("../chatCrypto/encryptedAttachments.service", () => ({ uploadEncryptedAttachment: jest.fn() }));
jest.mock("../media/mediaPreparation.service", () => ({ resizeAndReencodeImageWithoutMetadata: jest.fn() }));

import { api } from "../core/apiClient.service";
import { groupsService, type GroupInvitation } from "../social/groups.service";

const mockedApi = api as jest.Mocked<typeof api>;

describe("group invitation API contract", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates one invitation with an idempotency key and never adds membership directly", async () => {
    const invitation = { id: "invite-1", status: "pending", membershipStatus: "not_joined" } as GroupInvitation;
    mockedApi.post.mockResolvedValueOnce(invitation);

    await expect(groupsService.createGroupInvitation("group/1", "person-2")).resolves.toBe(invitation);
    expect(mockedApi.post).toHaveBeenCalledWith(
      "/api/v1/conversations/group%2F1/invitations",
      { inviteeId: "person-2" },
      { idempotencyKey: "group-invitation-key" },
    );
  });

  it.each(["received", "sent"] as const)("lists server invitations in the %s direction with cursor pagination", async (direction) => {
    await groupsService.listGroupInvitations(direction, "next-page");
    expect(mockedApi.getPage).toHaveBeenCalledWith("/api/v1/group-invitations", { direction, cursor: "next-page", limit: 20 });
  });

  it("accepts consent without treating the invitation as group membership", async () => {
    const accepted = { id: "invite-1", status: "accepted", membershipStatus: "awaiting_secure_key_handoff" } as GroupInvitation;
    mockedApi.post.mockResolvedValueOnce(accepted);

    await expect(groupsService.acceptGroupInvitation("invite-1")).resolves.toBe(accepted);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/group-invitations/invite-1/accept", undefined, { idempotencyKey: "group-invitation-key" });
    expect(accepted.membershipStatus).toBe("awaiting_secure_key_handoff");
  });

  it("declines by the server invitation id and revokes within its conversation", async () => {
    await groupsService.declineGroupInvitation("invite-2");
    await groupsService.revokeGroupInvitation("group-3", "invite-2");

    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/group-invitations/invite-2/decline", undefined, { idempotencyKey: "group-invitation-key" });
    expect(mockedApi.delete).toHaveBeenCalledWith("/api/v1/conversations/group-3/invitations/invite-2", { idempotencyKey: "group-invitation-key" });
  });

  it("creates, previews, claims, and revokes group links while keeping link claims as pending consent", async () => {
    const link = { id: "link-1", conversationId: "group-4", token: "a".repeat(43), expiresAt: "2026-11-13T12:00:00.000Z" };
    const preview = { group: { title: "Book club", memberCount: 3 }, expiresAt: link.expiresAt };
    const pending = { id: "invite-link-1", status: "pending", membershipStatus: "not_joined" } as GroupInvitation;
    mockedApi.post.mockResolvedValueOnce(link).mockResolvedValueOnce(pending);
    mockedApi.get.mockResolvedValueOnce(preview);
    mockedApi.delete.mockResolvedValueOnce({ id: link.id, conversationId: link.conversationId, revokedAt: link.expiresAt });

    await expect(groupsService.createGroupInvitationLink("group-4", 24)).resolves.toBe(link);
    await expect(groupsService.previewGroupInvitationLink(link.token)).resolves.toBe(preview);
    await expect(groupsService.claimGroupInvitationLink(link.token)).resolves.toBe(pending);
    await expect(groupsService.revokeGroupInvitationLink("group-4", link.id)).resolves.toMatchObject({ id: link.id });

    expect(mockedApi.post).toHaveBeenNthCalledWith(1, "/api/v1/conversations/group-4/invitation-links", { expiresInHours: 24 }, { idempotencyKey: "group-invitation-key" });
    expect(mockedApi.get).toHaveBeenCalledWith(`/api/v1/conversations/invitation-links/${link.token}/preview`);
    expect(mockedApi.post).toHaveBeenNthCalledWith(2, `/api/v1/conversations/invitation-links/${link.token}/claim`, undefined, { idempotencyKey: "group-invitation-key" });
    expect(mockedApi.delete).toHaveBeenCalledWith("/api/v1/conversations/group-4/invitation-links/link-1", { idempotencyKey: "group-invitation-key" });
    expect(pending.membershipStatus).toBe("not_joined");
  });

  it.each([24, 168, 720] as const)("sends the selected %i-hour group-link expiry to the API", async (expiresInHours) => {
    mockedApi.post.mockResolvedValueOnce({ id: "link-1", conversationId: "group-4", token: "a".repeat(43), expiresAt: "2026-11-13T12:00:00.000Z" });
    await groupsService.createGroupInvitationLink("group-4", expiresInHours);
    expect(mockedApi.post).toHaveBeenCalledWith(
      "/api/v1/conversations/group-4/invitation-links",
      { expiresInHours },
      { idempotencyKey: "group-invitation-key" },
    );
  });

  it("lists safe invitation-link metadata without requesting or returning the raw token", async () => {
    const page = { data: [{ id: "link-1", conversationId: "group-4", createdAt: "2026-11-06T12:00:00Z", expiresAt: "2026-11-13T12:00:00Z", revokedAt: null }], nextCursor: "link-cursor" };
    mockedApi.getPage.mockResolvedValueOnce(page);

    await expect(groupsService.listGroupInvitationLinks("group-4", "next-link")).resolves.toBe(page);
    expect(mockedApi.getPage).toHaveBeenCalledWith("/api/v1/conversations/group-4/invitation-links", { cursor: "next-link", limit: 20 });
    expect(page.data[0]).not.toHaveProperty("token");
  });
});
