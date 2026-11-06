jest.mock("../core/apiClient.service", () => ({
  api: {
    getPage: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn(),
  },
  generateIdempotencyKey: jest.fn(() => "spaces-test-key"),
}));

import { api } from "../core/apiClient.service";
import { spacesService, type SpaceInvitation } from "../spaces.service";

const mockedApi = api as jest.Mocked<typeof api>;

describe("spacesService contract", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists live and upcoming Spaces using the bounded discovery contract", async () => {
    await spacesService.list("next-page");
    expect(mockedApi.getPage).toHaveBeenCalledWith("/api/v1/spaces", { state: "live,upcoming", cursor: "next-page", limit: 30 });
  });

  it("lists authenticated pending Space invitations with cursor pagination", async () => {
    await spacesService.listInvitations("next-page");
    expect(mockedApi.getPage).toHaveBeenCalledWith("/api/v1/spaces/invitations", { limit: 30, cursor: "next-page" });
    await spacesService.listInvitations();
    expect(mockedApi.getPage).toHaveBeenLastCalledWith("/api/v1/spaces/invitations", { limit: 30, cursor: undefined });
  });

  it("accepts the persisted moderator invitation role in the response contract", async () => {
    const invitation: SpaceInvitation = {
      spaceId: "space-42", invitationId: "invite-7", role: "moderator", title: "Guest host",
      invitedAt: "2026-11-05T10:00:00Z", inviterId: "host-1",
      space: {
        id: "space-42", title: "Community hour", state: "scheduled", listenerCount: 0,
        host: { id: "host-1", name: "Host", role: "host" },
      },
    };
    mockedApi.getPage.mockResolvedValueOnce({ data: [invitation], nextCursor: null });
    await expect(spacesService.listInvitations()).resolves.toEqual({ data: [invitation], nextCursor: null });
  });

  it("responds to the exact server-issued invitation using authenticated idempotent actions", async () => {
    await spacesService.acceptInvitation("space-42", "invite-7");
    await spacesService.declineInvitation("space-42", "invite/8");
    expect(mockedApi.post).toHaveBeenNthCalledWith(1, "/api/v1/spaces/space-42/invites/invite-7/accept", undefined, { idempotencyKey: "spaces-test-key" });
    expect(mockedApi.post).toHaveBeenNthCalledWith(2, "/api/v1/spaces/space-42/invites/invite%2F8/decline", undefined, { idempotencyKey: "spaces-test-key" });
  });

  it("creates with an idempotency key and preserves the schedule payload", async () => {
    const input = { title: "Community hour", audiencePolicy: "public" as const, giftsEnabled: false, scheduledAt: "2026-11-02T17:30:00.000Z" };
    await spacesService.create(input);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/spaces", { title: input.title, visibility: "public", giftsEnabled: false, scheduledAt: input.scheduledAt }, { idempotencyKey: "spaces-test-key" });
  });

  it("updates the host-controlled coin support setting through the authenticated Space endpoint", async () => {
    await spacesService.setCoinDonations("space-42", false);
    expect(mockedApi.patch).toHaveBeenCalledWith("/api/v1/spaces/space-42/coin-donations", { enabled: false }, { idempotencyKey: "spaces-test-key" });
  });

  it("sends the selected Space invite role and optional stage title", async () => {
    await spacesService.invite("space-42", "account-7", "cohost", "Guest host");
    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/spaces/space-42/invites", {
      accountId: "account-7", role: "cohost", title: "Guest host",
    }, { idempotencyKey: "spaces-test-key" });

    await spacesService.invite("space-42", "account-8");
    expect(mockedApi.post).toHaveBeenLastCalledWith("/api/v1/spaces/space-42/invites", {
      accountId: "account-8", role: "listener",
    }, { idempotencyKey: "spaces-test-key" });
  });

  it("sends a coin amount rather than a virtual gift SKU for Space support", async () => {
    await spacesService.sendCoinDonation("space-42", 125, "donation-key-0001");
    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/spaces/space-42/coin-donations", { coins: 125 }, { idempotencyKey: "donation-key-0001" });
  });

  it("uses the documented session, join and speaker request paths", async () => {
    await spacesService.detail("space/42");
    await spacesService.join("space/42");
    await spacesService.requestToSpeak("space/42");
    expect(mockedApi.get).toHaveBeenCalledWith("/api/v1/spaces/space%2F42");
    expect(mockedApi.post).toHaveBeenNthCalledWith(1, "/api/v1/spaces/space%2F42/join", undefined, { idempotencyKey: "spaces-test-key" });
    expect(mockedApi.post).toHaveBeenNthCalledWith(2, "/api/v1/spaces/space%2F42/speaker-requests", undefined, { idempotencyKey: "spaces-test-key" });
  });

  it("returns the server-issued audio grant and publish permission from join", async () => {
    const grant = { spaceId: "space-42", role: "listener", token: "space-jwt", url: "wss://audio.test", canPublish: false, listeners: 12 } as const;
    mockedApi.post.mockResolvedValueOnce(grant);

    await expect(spacesService.join("space-42")).resolves.toEqual(grant);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/spaces/space-42/join", undefined, { idempotencyKey: "spaces-test-key" });
  });

  it("wires role controls and end/leave transitions to session routes", async () => {
    await spacesService.approveSpeakerRequest("s1", "r1");
    await spacesService.muteSpeaker("s1", "u1");
    await spacesService.leave("s1");
    await spacesService.end("s1");
    expect(mockedApi.post).toHaveBeenNthCalledWith(1, "/api/v1/spaces/s1/speaker-requests/r1/approve", undefined, { idempotencyKey: "spaces-test-key" });
    expect(mockedApi.post).toHaveBeenNthCalledWith(2, "/api/v1/spaces/s1/speakers/u1/mute", undefined, { idempotencyKey: "spaces-test-key" });
    expect(mockedApi.post).toHaveBeenNthCalledWith(3, "/api/v1/spaces/s1/leave", undefined, { idempotencyKey: "spaces-test-key" });
    expect(mockedApi.post).toHaveBeenNthCalledWith(4, "/api/v1/spaces/s1/end", undefined, { idempotencyKey: "spaces-test-key" });
  });
});
