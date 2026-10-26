jest.mock("../core/apiClient.service", () => ({
  api: {
    getPage: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(),
  },
  generateIdempotencyKey: jest.fn(() => "spaces-test-key"),
}));

import { api } from "../core/apiClient.service";
import { spacesService } from "../spaces.service";

const mockedApi = api as jest.Mocked<typeof api>;

describe("spacesService contract", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists live and upcoming Spaces using the bounded discovery contract", async () => {
    await spacesService.list("next-page");
    expect(mockedApi.getPage).toHaveBeenCalledWith("/api/v1/spaces", { state: "live,upcoming", cursor: "next-page", limit: 30 });
  });

  it("creates with an idempotency key and preserves the schedule payload", async () => {
    const input = { title: "Community hour", audiencePolicy: "public" as const, scheduledAt: "2026-11-02T17:30:00.000Z" };
    await spacesService.create(input);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/spaces", input, { idempotencyKey: "spaces-test-key" });
  });

  it("uses the documented session, join and speaker request paths", async () => {
    await spacesService.detail("space/42");
    await spacesService.join("space/42");
    await spacesService.requestToSpeak("space/42");
    expect(mockedApi.get).toHaveBeenCalledWith("/api/v1/spaces/space%2F42");
    expect(mockedApi.post).toHaveBeenNthCalledWith(1, "/api/v1/spaces/space%2F42/join");
    expect(mockedApi.post).toHaveBeenNthCalledWith(2, "/api/v1/spaces/space%2F42/speaker-requests");
  });

  it("returns the server-issued audio grant and publish permission from join", async () => {
    const grant = { spaceId: "space-42", role: "listener", token: "space-jwt", url: "wss://audio.test", canPublish: false, listeners: 12 } as const;
    mockedApi.post.mockResolvedValueOnce(grant);

    await expect(spacesService.join("space-42")).resolves.toEqual(grant);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/spaces/space-42/join");
  });

  it("wires role controls and end/leave transitions to session routes", async () => {
    await spacesService.approveSpeakerRequest("s1", "r1");
    await spacesService.muteSpeaker("s1", "u1");
    await spacesService.leave("s1");
    await spacesService.end("s1");
    expect(mockedApi.post).toHaveBeenNthCalledWith(1, "/api/v1/spaces/s1/speaker-requests/r1/approve");
    expect(mockedApi.post).toHaveBeenNthCalledWith(2, "/api/v1/spaces/s1/speakers/u1/mute");
    expect(mockedApi.post).toHaveBeenNthCalledWith(3, "/api/v1/spaces/s1/leave");
    expect(mockedApi.post).toHaveBeenNthCalledWith(4, "/api/v1/spaces/s1/end", undefined, { idempotencyKey: "spaces-test-key" });
  });
});
