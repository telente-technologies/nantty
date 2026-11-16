jest.mock("../core/apiClient.service", () => ({
  api: { getList: jest.fn(), get: jest.fn(), post: jest.fn() },
}));
jest.mock("../chatCrypto/chatCrypto.service", () => ({ chatCryptoService: {} }));

import { api } from "../core/apiClient.service";
import { storiesService } from "../clips/stories.service";

const mockedApi = api as jest.Mocked<typeof api>;

describe("storiesService post audience contract", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(["everyone", "followers"] as const)("sends %s unchanged to the create-post endpoint", async (audience) => {
    const input = { text: "Audience contract", mediaIds: [], audience };
    await storiesService.publishPost(input);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/posts", input);
  });
});
