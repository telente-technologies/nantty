jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(() => () => {}), fetch: jest.fn(async () => ({ isConnected: true })) },
}));
jest.mock("@/store/offline.store", () => ({
  useOfflineStore: { getState: () => ({ enqueueAction: jest.fn() }) },
}));

jest.mock("../core/apiClient.service", () => ({
  api: {
    get: jest.fn(),
    getList: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
  generateIdempotencyKey: jest.fn(() => "idem_test"),
}));

import { ApiError } from "@/errors/api.error";
import { api } from "../core/apiClient.service";
import { consentsService } from "../account/consents.service";
import { postsService } from "../content/posts.service";
import { brandsService } from "../sellers/brands.service";

const mockedApi = api as jest.Mocked<typeof api>;

describe("PAR-011..013 mobile parity services", () => {
  beforeEach(() => jest.clearAllMocks());

  it("handles deletion status 404 gracefully and cancels active deletion requests", async () => {
    mockedApi.get.mockRejectedValueOnce(new ApiError(404, "No deletion request", "NOT_FOUND"));
    await expect(consentsService.fetchAccountDeletionStatus()).resolves.toBeNull();

    mockedApi.get.mockResolvedValueOnce({ status: "scheduled", scheduledFor: "2026-12-16T00:00:00Z" });
    await expect(consentsService.fetchAccountDeletionStatus()).resolves.toEqual({ status: "scheduled", scheduledFor: "2026-12-16T00:00:00Z" });

    await consentsService.cancelAccountDeletion();
    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/users/me/deletion-request/cancel", {});
  });

  it("reads/updates tagging settings and removes own post tag", async () => {
    await consentsService.fetchMyTaggingSettings();
    await consentsService.updateMyTaggingSettings(false);
    await postsService.removeMyPostTag("post/99");

    expect(mockedApi.get).toHaveBeenCalledWith("/api/v1/me/tagging-settings");
    expect(mockedApi.put).toHaveBeenCalledWith("/api/v1/me/tagging-settings", { allowTagging: false });
    expect(mockedApi.delete).toHaveBeenCalledWith("/api/v1/posts/post%2F99/tags/me");
  });

  it("lists, accepts, and declines store team requests", async () => {
    await brandsService.fetchStoreTeamRequests();
    await brandsService.acceptStoreTeamRequest("req/1");
    await brandsService.declineStoreTeamRequest("req/2");

    expect(mockedApi.getList).toHaveBeenCalledWith("/api/v1/stores/team-requests");
    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/stores/team-requests/req%2F1/accept", {});
    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/stores/team-requests/req%2F2/decline", {});
  });
});
