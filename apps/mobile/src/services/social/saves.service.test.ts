jest.mock("../core/apiClient.service", () => ({
  api: { get: jest.fn(), getPage: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

import { api } from "../core/apiClient.service";
import { savesService } from "./saves.service";

const mockedApi = jest.mocked(api);

describe("saves service", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reads the authenticated status for the exact product save target", async () => {
    mockedApi.get.mockResolvedValue({ isSaved: true });

    await expect(savesService.fetchSaveStatus({ type: "product", targetId: "product-1" })).resolves.toEqual({ isSaved: true });
    expect(mockedApi.get).toHaveBeenCalledWith("/api/v1/saves/status", { type: "product", targetId: "product-1" });
  });
});
