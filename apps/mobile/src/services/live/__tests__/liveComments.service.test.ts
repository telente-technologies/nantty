const mockGet = jest.fn();

jest.mock("../../core/apiClient.service", () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
  generateIdempotencyKey: () => "unused-key",
}));

import { liveService } from "../live.service";

describe("live comments service", () => {
  beforeEach(() => mockGet.mockReset());

  it("requests newest-first pages so the live surface can show the latest comments", async () => {
    const page = { data: [], nextCursor: null };
    mockGet.mockResolvedValue(page);

    await expect(liveService.fetchLiveComments("live-1")).resolves.toBe(page);

    expect(mockGet).toHaveBeenCalledWith("/api/v1/lives/live-1/comments", { cursor: undefined, order: "newest" });
  });

  it("preserves cursor paging while requesting newest-first results", async () => {
    mockGet.mockResolvedValue({ data: [], nextCursor: null });

    await liveService.fetchLiveComments("live-1", "opaque-cursor");

    expect(mockGet).toHaveBeenCalledWith("/api/v1/lives/live-1/comments", { cursor: "opaque-cursor", order: "newest" });
  });
});
