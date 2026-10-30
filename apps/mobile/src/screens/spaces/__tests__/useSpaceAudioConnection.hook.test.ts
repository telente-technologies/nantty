import { act, renderHook } from "@testing-library/react-native";

class MockRoom {
  static created: MockRoom[] = [];
  handlers = new Map<string, (...args: unknown[]) => void>();
  connect = jest.fn(async (_url: string, _token: string, _options: { autoSubscribe: boolean }) => undefined);
  disconnect = jest.fn(async () => undefined);
  removeAllListeners = jest.fn(() => this.handlers.clear());
  setMicrophoneEnabled = jest.fn(async (_enabled: boolean) => undefined);
  localParticipant = { setMicrophoneEnabled: this.setMicrophoneEnabled };

  constructor() { MockRoom.created.push(this); }
  on(event: string, handler: (...args: unknown[]) => void) {
    this.handlers.set(event, handler);
    return this;
  }
  emit(event: string, ...args: unknown[]) { this.handlers.get(event)?.(...args); }
}

const mockAudio = {
  configureAudio: jest.fn(async () => undefined),
  startAudioSession: jest.fn(async () => undefined),
  stopAudioSession: jest.fn(async () => undefined),
};
const mockRuntime = {
  client: { RoomEvent: { Reconnecting: "reconnecting", Reconnected: "reconnected", Disconnected: "disconnected" } },
  native: { AudioSession: mockAudio, AndroidAudioTypePresets: { communication: "communication", media: "media" } },
  createRoom: () => new MockRoom(),
};
const mockJoin = jest.fn();

jest.mock("@/services/live/liveKitRuntime.service", () => ({ loadLiveKitRuntime: () => mockRuntime }));
jest.mock("@/services/spaces.service", () => ({ spacesService: { join: (spaceId: string) => mockJoin(spaceId) } }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useSpaceAudioConnection } = require("../useSpaceAudioConnection.hook") as typeof import("../useSpaceAudioConnection.hook");

const listenerGrant = { spaceId: "space-1", role: "listener", token: "listener-jwt", url: "wss://audio.test", canPublish: false, listeners: 8 } as const;
const hostGrant = { ...listenerGrant, role: "host", token: "host-jwt", canPublish: true } as const;
const flush = async () => { for (let index = 0; index < 5; index += 1) await Promise.resolve(); };

describe("useSpaceAudioConnection", () => {
  it("reconnects an approved listener muted, and revokes microphone control on demotion", async () => {
    const speakerGrant = { ...listenerGrant, role: "speaker" as const, token: "speaker-jwt", canPublish: true };
    const {result,rerender} = await renderHook(({grant}: {grant: import("@/services/spaces.service").SpaceJoinGrant}) => useSpaceAudioConnection("space-1",true,grant), {initialProps:{grant:listenerGrant}});
    await act(async () => flush());
    await rerender({grant:speakerGrant});
    await act(async () => flush());
    expect(MockRoom.created[0]!.disconnect).toHaveBeenCalled();
    expect(result.current.canPublish).toBe(true);
    expect(result.current.isMuted).toBe(true);
    expect(MockRoom.created[1]!.setMicrophoneEnabled).not.toHaveBeenCalled();
    await act(async () => result.current.toggleMicrophone());
    expect(MockRoom.created[1]!.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    await rerender({grant:listenerGrant});
    await act(async () => flush());
    expect(MockRoom.created[1]!.disconnect).toHaveBeenCalled();
    expect(result.current.canPublish).toBe(false);
    expect(result.current.isMuted).toBe(true);
    await act(async () => result.current.toggleMicrophone());
    expect(MockRoom.created[2]!.setMicrophoneEnabled).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    jest.useFakeTimers();
    MockRoom.created = [];
    mockJoin.mockReset();
    mockAudio.configureAudio.mockClear();
    mockAudio.startAudioSession.mockClear();
    mockAudio.stopAudioSession.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it("connects listeners as subscribe-only and never enables a microphone", async () => {
    const { result, unmount } = await renderHook(() => useSpaceAudioConnection("space-1", true, listenerGrant));
    await act(async () => flush());

    expect(result.current.status).toBe("connected");
    expect(result.current.canPublish).toBe(false);
    expect(MockRoom.created[0]!.connect).toHaveBeenCalledWith("wss://audio.test", "listener-jwt", { autoSubscribe: true });
    expect(mockAudio.configureAudio).toHaveBeenCalledWith(expect.objectContaining({ android: expect.objectContaining({ audioTypeOptions: "media" }) }));
    await act(async () => result.current.toggleMicrophone());
    expect(MockRoom.created[0]!.setMicrophoneEnabled).not.toHaveBeenCalled();
    await unmount();
    expect(MockRoom.created[0]!.disconnect).toHaveBeenCalledTimes(1);
    expect(mockAudio.stopAudioSession).toHaveBeenCalled();
  });

  it("allows an approved host to explicitly unmute the audio track only", async () => {
    const { result } = await renderHook(() => useSpaceAudioConnection("space-1", true, hostGrant));
    await act(async () => flush());

    expect(result.current.canPublish).toBe(true);
    expect(result.current.isMuted).toBe(true);
    expect(MockRoom.created[0]!.setMicrophoneEnabled).not.toHaveBeenCalled();
    await act(async () => result.current.toggleMicrophone());
    expect(MockRoom.created[0]!.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    expect(result.current.isMuted).toBe(false);
    await act(async () => result.current.toggleMicrophone());
    expect(MockRoom.created[0]!.setMicrophoneEnabled).toHaveBeenLastCalledWith(false);
    expect(result.current.isMuted).toBe(true);
  });

  it("fails closed if a listener grant incorrectly claims microphone publishing", async () => {
    const unsafeGrant = { ...listenerGrant, canPublish: true };
    const { result } = await renderHook(() => useSpaceAudioConnection("space-1", true, unsafeGrant));
    await act(async () => flush());
    expect(result.current.canPublish).toBe(false);
    await act(async () => result.current.toggleMicrophone());
    expect(MockRoom.created[0]!.setMicrophoneEnabled).not.toHaveBeenCalled();
  });

  it("requests a fresh join grant after an unexpected disconnect", async () => {
    mockJoin.mockResolvedValue(listenerGrant);
    const { result } = await renderHook(() => useSpaceAudioConnection("space-1", true, listenerGrant));
    await act(async () => flush());
    await act(async () => MockRoom.created[0]!.emit("disconnected", 14));
    expect(result.current.status).toBe("reconnecting");
    await act(async () => jest.advanceTimersByTime(1_000));
    await act(async () => flush());
    expect(mockJoin).toHaveBeenCalledWith("space-1");
    expect(MockRoom.created).toHaveLength(2);
    expect(MockRoom.created[1]!.connect).toHaveBeenCalledWith("wss://audio.test", "listener-jwt", { autoSubscribe: true });
  });
});
