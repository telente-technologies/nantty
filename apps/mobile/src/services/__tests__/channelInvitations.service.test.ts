jest.mock("../core/apiClient.service", () => ({
  api: { get: jest.fn(), getPage: jest.fn(), post: jest.fn(), delete: jest.fn() },
  generateIdempotencyKey: jest.fn(() => "channel-invitation-key"),
}));

import { api } from "../core/apiClient.service";
import { channelsService } from "../social/channels.service";

const mockedApi = api as jest.Mocked<typeof api>;

describe("channel invitation API contract", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates a link with an encoded channel id and idempotency key", async () => {
    const link = { id: "link-1", channelId: "channel/1", token: "opaque-token", expiresAt: "2026-11-13T12:00:00Z" };
    mockedApi.post.mockResolvedValueOnce(link);
    await expect(channelsService.createInvitationLink("channel/1", 24)).resolves.toBe(link);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/channels/channel%2F1/invitation-links", { expiresInHours: 24 }, { idempotencyKey: "channel-invitation-key" });
  });

  it("previews and claims an encoded opaque token; claim is only a pending invitation", async () => {
    const pending = { id: "inv-1", channelId: "channel-1", status: "pending" as const };
    mockedApi.get.mockResolvedValueOnce({ channel: { title: "Updates", subscriberCount: 5 }, expiresAt: "2026-11-13T12:00:00Z" });
    mockedApi.post.mockResolvedValueOnce(pending);
    await channelsService.previewInvitationLink("token/with+reserved");
    await expect(channelsService.claimInvitationLink("token/with+reserved")).resolves.toBe(pending);
    expect(mockedApi.get).toHaveBeenCalledWith("/api/v1/channels/invitation-links/token%2Fwith%2Breserved/preview");
    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/channels/invitation-links/token%2Fwith%2Breserved/claim", undefined, { idempotencyKey: "channel-invitation-key" });
    expect(pending.status).toBe("pending");
  });

  it("manages channel link metadata and pending invitations separately from self-subscribe", async () => {
    const page = { data: [{ id: "link-1", channelId: "channel-1", expiresAt: "2026-11-13T12:00:00Z", revokedAt: null }], nextCursor: "next" };
    mockedApi.getPage.mockResolvedValueOnce(page).mockResolvedValueOnce({ data: [], nextCursor: null });
    await channelsService.listInvitationLinks("channel-1", "cursor");
    await channelsService.listInvitations();
    await channelsService.revokeInvitationLink("channel-1", "link/1");
    await channelsService.acceptInvitation("invite/1");
    await channelsService.declineInvitation("invite/2");
    expect(mockedApi.getPage).toHaveBeenNthCalledWith(1, "/api/v1/channels/channel-1/invitation-links", { cursor: "cursor", limit: 20 });
    expect(mockedApi.getPage).toHaveBeenNthCalledWith(2, "/api/v1/channel-invitations", { status: "pending", cursor: undefined, limit: 20 });
    expect(mockedApi.delete).toHaveBeenCalledWith("/api/v1/channels/channel-1/invitation-links/link%2F1", { idempotencyKey: "channel-invitation-key" });
    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/channel-invitations/invite%2F1/accept", undefined, { idempotencyKey: "channel-invitation-key" });
    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/channel-invitations/invite%2F2/decline", undefined, { idempotencyKey: "channel-invitation-key" });
    expect(mockedApi.post).not.toHaveBeenCalledWith("/api/v1/channels/channel-1/subscribe", expect.anything());
  });
});
