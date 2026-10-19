import { act, renderHook } from "@testing-library/react-native";

import { useVoiceNotePlayer, voiceNotePlaybackCoordinator } from "../voiceNotePlayer.hook";

interface FakeNativePlayer {
  released: boolean;
  readonly pause: jest.Mock;
  readonly play: jest.Mock;
  readonly replace: jest.Mock;
  readonly seekTo: jest.Mock;
  readonly setPlaybackRate: jest.Mock;
}

const mockNativePlayers: FakeNativePlayer[] = [];

function mockCreateFakeNativePlayer(): FakeNativePlayer {
  const fake: FakeNativePlayer = {
    released: false,
    pause: jest.fn(),
    play: jest.fn(),
    replace: jest.fn(),
    seekTo: jest.fn(async () => undefined),
    setPlaybackRate: jest.fn(),
  };
  const throwWhenReleased = (method: jest.Mock) =>
    method.mockImplementation((...args: unknown[]) => {
      if (fake.released) throw new Error("NotFoundException: Unable to find the native shared object associated with given JavaScript object");
      if (method === fake.replace && (args[0] === null || typeof args[0] !== "object")) throw new Error("ArgumentCastException: The 1st argument cannot be cast to type AudioSource");
      return method === fake.seekTo ? Promise.resolve() : undefined;
    });
  [fake.pause, fake.play, fake.replace, fake.seekTo, fake.setPlaybackRate].forEach(throwWhenReleased);
  return fake;
}

jest.mock("expo-audio", () => ({
  useAudioPlayer: () => {
    const { useEffect, useRef } = jest.requireActual("react");
    const player = useRef(null);
    if (!player.current) {
      player.current = mockCreateFakeNativePlayer();
      mockNativePlayers.push(player.current);
    }
    useEffect(() => () => {
      player.current.released = true;
    }, []);
    return player.current;
  },
  useAudioPlayerStatus: () => ({ playing: false, currentTime: 0, duration: 0, didJustFinish: false }),
}));

const previewSource = (uri: string) => () => ({ uri, release: null });

beforeEach(() => {
  mockNativePlayers.length = 0;
});

describe("useVoiceNotePlayer", () => {
  it("only replaces the source with a non-empty uri and never with null", async () => {
    const { result } = await renderHook(() => useVoiceNotePlayer("composer-preview", 4));
    const nativePlayer = mockNativePlayers[0]!;
    await act(async () => result.current.play("", previewSource("")));
    await act(async () => result.current.play("missing", () => null));
    expect(nativePlayer.replace).not.toHaveBeenCalled();
    expect(nativePlayer.play).not.toHaveBeenCalled();
    await act(async () => result.current.play("file:///voice.m4a", previewSource("file:///voice.m4a")));
    expect(nativePlayer.replace).toHaveBeenCalledWith({ uri: "file:///voice.m4a" });
    expect(nativePlayer.play).toHaveBeenCalledTimes(1);
    await act(async () => result.current.unload());
    expect(nativePlayer.replace).toHaveBeenCalledTimes(1);
  });

  it("releases the decrypted file when the source cannot be loaded", async () => {
    const release = jest.fn();
    const { result } = await renderHook(() => useVoiceNotePlayer("voice-note-a", 4));
    await act(async () => result.current.play("blank", () => ({ uri: "  ", release })));
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("does not touch the native player after unmount and unregisters from the coordinator", async () => {
    const preview = await renderHook(() => useVoiceNotePlayer("composer-preview", 4));
    const bubble = await renderHook(() => useVoiceNotePlayer("voice-note-b", 4));
    const previewPlayer = mockNativePlayers[0]!;
    await act(async () => preview.result.current.play("file:///voice.m4a", previewSource("file:///voice.m4a")));
    const pauseCallsBeforeUnmount = previewPlayer.pause.mock.calls.length;
    await preview.unmount();
    expect(previewPlayer.released).toBe(true);
    expect(() => preview.result.current.pause()).not.toThrow();
    expect(() => preview.result.current.play("file:///voice.m4a", previewSource("file:///voice.m4a"))).not.toThrow();
    await act(async () => bubble.result.current.play("https://media.example/b", previewSource("https://media.example/b")));
    expect(previewPlayer.pause.mock.calls.length).toBe(pauseCallsBeforeUnmount + 1);
    expect(() => voiceNotePlaybackCoordinator.claim("another", jest.fn())).not.toThrow();
    await bubble.unmount();
  });
});
