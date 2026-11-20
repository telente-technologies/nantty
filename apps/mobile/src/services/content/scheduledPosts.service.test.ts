jest.mock("../core/apiClient.service", () => ({ api: { getList: jest.fn(), getPage: jest.fn(), patch: jest.fn(), post: jest.fn(), delete: jest.fn() } }));

import { api } from "../core/apiClient.service";
import { scheduledPostsService } from "./scheduledPosts.service";

const mockedApi = api as jest.Mocked<typeof api>;

describe("scheduledPostsService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists only the signed-in user's scheduled-post collection endpoint", async () => {
    await scheduledPostsService.list();
    expect(mockedApi.getPage).toHaveBeenCalledWith("/api/v1/posts/scheduled", { cursor: undefined, limit: 20 });
    await scheduledPostsService.list("0192f0a0-0000-7000-8000-0000000000a1");
    expect(mockedApi.getPage).toHaveBeenLastCalledWith("/api/v1/posts/scheduled", { cursor: "0192f0a0-0000-7000-8000-0000000000a1", limit: 20 });
  });

  it("supports rescheduling, content editing, publish-now and cancel actions", async () => {
    const postId = "0192f0a0-0000-7000-8000-0000000000a1";
    const scheduledAt = "2026-10-10T15:00:00.000Z";
    await scheduledPostsService.reschedule(postId, scheduledAt);
    await scheduledPostsService.editContent(postId, { text: "Updated copy" });
    await scheduledPostsService.publishNow(postId);
    await scheduledPostsService.cancel(postId);

    expect(mockedApi.patch).toHaveBeenCalledWith(`/api/v1/posts/${postId}/schedule`, { scheduledAt });
    expect(mockedApi.patch).toHaveBeenCalledWith(`/api/v1/posts/${postId}/schedule/content`, { text: "Updated copy" });
    expect(mockedApi.post).toHaveBeenCalledWith(`/api/v1/posts/${postId}/schedule/publish-now`, {});
    expect(mockedApi.delete).toHaveBeenCalledWith(`/api/v1/posts/${postId}/schedule`);
  });
});
