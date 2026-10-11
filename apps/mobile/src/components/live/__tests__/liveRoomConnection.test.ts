import { act, renderHook } from "@testing-library/react-native";

import { ApiError } from "@/errors/api.error";

type Handler = (...args: unknown[]) => void;

class MockRoom {
  static created: MockRoom[] = [];
  static failConnect = false;
  handlers = new Map<string, Handler[]>();
  connectedWith: [string, string] | null = null;
  disconnects = 0;
  localParticipant = { isLocal: true };
  remoteParticipants = new Map();
  constructor() {
    MockRoom.created.push(this);
  }
  on(event: string, handler: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }
  emit(event: string, ...args: unknown[]) {
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
  }
  removeAllListeners() {
    this.handlers.clear();
  }
  async connect(url: string, token: string) {
    if (MockRoom.failConnect) throw new Error("could not establish signal connection");
    this.connectedWith = [url, token];
  }
  async disconnect() {
    this.disconnects += 1;
  }
}

const mockAudio = { configureAudio: jest.fn(async () => undefined), startAudioSession: jest.fn(async () => undefined), stopAudioSession: jest.fn(async () => undefined) };
const RoomEvent = { Reconnecting: "reconnecting", Reconnected: "reconnected", Disconnected: "disconnected", ConnectionQualityChanged: "quality", TrackSubscribed: "ts", TrackUnsubscribed: "tu", TrackMuted: "tm", TrackUnmuted: "tum", LocalTrackPublished: "lp", LocalTrackUnpublished: "lu", ParticipantConnected: "pc", ParticipantDisconnected: "pd" };
const mockRuntime = { client: { RoomEvent }, native: { AudioSession: mockAudio, AndroidAudioTypePresets: { communication: "comm", media: "media" } }, createRoom: () => new MockRoom() };
const mockIssueMediaToken = jest.fn();

jest.mock("@/services/live/liveKitRuntime.service", () => ({ loadLiveKitRuntime: () => mockRuntime }));
jest.mock("@/services/live/liveMedia.service", () => ({ liveMediaService: { issueMediaToken: (liveId: string) => mockIssueMediaToken(liveId) } }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useLiveRoomConnection } = require("../media/liveRoomConnection.hook") as typeof import("../media/liveRoomConnection.hook");

const grant = { url: "wss://livekit.example", token: "jwt", canPublish: true, role: "host" };
const flush = async () => {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) await Promise.resolve();
  });
};

describe("LiveKit room connection", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    MockRoom.created = [];
    MockRoom.failConnect = false;
    mockIssueMediaToken.mockReset();
    mockAudio.configureAudio.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it("connects with a fresh host token and drives the reconnecting banner from LiveKit events", async () => {
    mockIssueMediaToken.mockResolvedValue(grant);
    const { result } = await renderHook(() => useLiveRoomConnection("live-1", { isEnabled: true, isPublisher: true }));
    await flush();
    expect(result.current.status).toBe("connected");
    expect(result.current.canPublish).toBe(true);
    expect(MockRoom.created[0]!.connectedWith).toEqual(["wss://livekit.example", "jwt"]);
    expect(mockAudio.configureAudio).toHaveBeenCalledWith(expect.objectContaining({ android: expect.objectContaining({ audioTypeOptions: "comm", preferredOutputList: ["bluetooth", "headset", "speaker"] }) }));
    await act(async () => MockRoom.created[0]!.emit("reconnecting"));
    expect(result.current.status).toBe("reconnecting");
    await act(async () => MockRoom.created[0]!.emit("reconnected"));
    expect(result.current.status).toBe("connected");
  });

  it("reports the live as ended when the server deletes the room", async () => {
    mockIssueMediaToken.mockResolvedValue({ ...grant, canPublish: false, role: "viewer" });
    const { result } = await renderHook(() => useLiveRoomConnection("live-1", { isEnabled: true, isPublisher: false }));
    await flush();
    await act(async () => MockRoom.created[0]!.emit("disconnected", 5));
    expect(result.current.status).toBe("ended");
  });

  it("asks for a new token after an unexpected disconnect, instead of reusing the old one", async () => {
    mockIssueMediaToken.mockResolvedValue(grant);
    const { result } = await renderHook(() => useLiveRoomConnection("live-1", { isEnabled: true, isPublisher: true }));
    await flush();
    await act(async () => MockRoom.created[0]!.emit("disconnected", 14));
    expect(result.current.status).toBe("reconnecting");
    await act(async () => jest.advanceTimersByTime(1_000));
    await flush();
    expect(mockIssueMediaToken).toHaveBeenCalledTimes(2);
    expect(MockRoom.created).toHaveLength(2);
    expect(result.current.status).toBe("connected");
  });

  it("stops retrying after repeated failures and when the live is already over", async () => {
    MockRoom.failConnect = true;
    mockIssueMediaToken.mockResolvedValue(grant);
    const { result } = await renderHook(() => useLiveRoomConnection("live-1", { isEnabled: true, isPublisher: true }));
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await flush();
      await act(async () => jest.advanceTimersByTime(15_000));
    }
    expect(result.current.status).toBe("failed");

    mockIssueMediaToken.mockRejectedValue(new ApiError(409, "This live is not active.", "LIVE_NOT_ACTIVE"));
    const ended = await renderHook(() => useLiveRoomConnection("live-2", { isEnabled: true, isPublisher: false }));
    await flush();
    expect(ended.result.current.status).toBe("ended");
  });

  it("does nothing until the viewer joins, and disconnects on leave", async () => {
    mockIssueMediaToken.mockResolvedValue(grant);
    const { result, rerender, unmount } = await renderHook(({ enabled }: { enabled: boolean }) => useLiveRoomConnection("live-1", { isEnabled: enabled, isPublisher: false }), { initialProps: { enabled: false } });
    await flush();
    expect(result.current.status).toBe("idle");
    expect(mockIssueMediaToken).not.toHaveBeenCalled();
    await rerender({ enabled: true });
    await flush();
    expect(result.current.status).toBe("connected");
    await unmount();
    expect(MockRoom.created[0]!.disconnects).toBe(1);
    expect(mockAudio.stopAudioSession).toHaveBeenCalled();
  });
});
