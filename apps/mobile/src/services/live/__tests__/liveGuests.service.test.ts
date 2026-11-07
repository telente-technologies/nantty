const mockPost = jest.fn();

jest.mock("../../core/apiClient.service", () => ({
  api: { post: (...args: unknown[]) => mockPost(...args) },
  generateIdempotencyKey: () => "unused-idempotency-key",
}));

import { liveGuestsService } from "../liveGuests.service";

describe("Live stage invitations", () => {
  beforeEach(() => mockPost.mockReset());

  it("sends role and optional title to the existing invitation endpoint", async () => {
    const stage = { liveId: "live-1" };
    mockPost.mockResolvedValue(stage);

    await expect(liveGuestsService.inviteViewerToStage("live-1", "viewer-1", "cohost", "  Guest expert  ")).resolves.toBe(stage);

    expect(mockPost).toHaveBeenCalledWith("/api/v1/lives/live-1/guests/invitations", {
      userId: "viewer-1",
      role: "cohost",
      title: "Guest expert",
    });
  });

  it("defaults legacy callers to a speaker invitation and omits blank title", async () => {
    mockPost.mockResolvedValue({ liveId: "live-1" });

    await liveGuestsService.inviteViewerToStage("live-1", "viewer-1");

    expect(mockPost).toHaveBeenCalledWith("/api/v1/lives/live-1/guests/invitations", {
      userId: "viewer-1",
      role: "speaker",
    });
  });
});
