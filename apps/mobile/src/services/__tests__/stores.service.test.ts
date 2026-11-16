jest.mock("../core/apiClient.service", () => ({
  api: { get: jest.fn(), getList: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

import { api } from "../core/apiClient.service";
import { storesService } from "../sellers/stores.service";

describe("store follow service contract", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns canonical state directly from follow and unfollow writes", async () => {
    const storeId = "0192a4f0-0000-7000-8000-000000000000";
    const following = { storeId, isFollowing: true, followers: 19 };
    const notFollowing = { storeId, isFollowing: false, followers: 18 };
    jest.mocked(api.post).mockResolvedValue(following);
    jest.mocked(api.delete).mockResolvedValue(notFollowing);

    await expect(storesService.followStore(storeId)).resolves.toEqual(following);
    await expect(storesService.unfollowStore(storeId)).resolves.toEqual(notFollowing);

    expect(api.post).toHaveBeenCalledWith(`/api/v1/stores/${storeId}/follow`);
    expect(api.delete).toHaveBeenCalledWith(`/api/v1/stores/${storeId}/follow`);
    expect(api.get).not.toHaveBeenCalledWith(`/api/v1/stores/${storeId}/follow-status`);
  });

  it("rejects a malformed or mismatched mutation response", async () => {
    jest.mocked(api.post).mockResolvedValue({ storeId: "another-store", isFollowing: true, followers: -1 });

    await expect(storesService.followStore("store-1")).rejects.toThrow("invalid store-follow state");
  });
});
