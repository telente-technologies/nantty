jest.mock("../core/apiClient.service", () => ({
  api: { get: jest.fn(), getList: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

import { api } from "../core/apiClient.service";
import { storesService } from "./stores.service";

describe("store follow API contract", () => {
  beforeEach(() => jest.clearAllMocks());

  it("follows and unfollows through the authenticated social gateway routes", async () => {
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

  it("encodes store identifiers as one route segment", async () => {
    jest.mocked(api.post).mockResolvedValue({ storeId: "store/with spaces", isFollowing: true, followers: 1 });
    await storesService.followStore("store/with spaces");
    expect(api.post).toHaveBeenCalledWith("/api/v1/stores/store%2Fwith%20spaces/follow");
  });
});
