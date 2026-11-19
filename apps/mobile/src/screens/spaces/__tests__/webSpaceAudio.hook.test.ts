import { act, renderHook } from "@testing-library/react-native";
jest.mock("../../../../../webapp/node_modules/react", () => jest.requireActual("react"), { virtual: true });

class MockWebRoom {
  static created: MockWebRoom[] = [];
  setMicrophoneEnabled = jest.fn(async () => undefined);
  localParticipant = { setMicrophoneEnabled: this.setMicrophoneEnabled };
  connect = jest.fn(async () => undefined);
  disconnect = jest.fn(async () => undefined);
  removeAllListeners = jest.fn();
  on = jest.fn(() => this);
  constructor() {
    MockWebRoom.created.push(this);
  }
}
jest.mock("livekit-client", () => ({
  Room: MockWebRoom,
  RoomEvent: {
    TrackSubscribed: "trackSubscribed",
    TrackUnsubscribed: "trackUnsubscribed",
    Reconnecting: "reconnecting",
    Reconnected: "reconnected",
    Disconnected: "disconnected",
  },
  Track: { Kind: { Audio: "audio" } },
}));
// Exercise the web hook with the same installed React renderer, without browser media.
const { useSpaceAudio } = require("../../../../../webapp/src/components/spaces/spaceAudio.hook") as typeof import("../../../../../webapp/src/components/spaces/spaceAudio.hook");
import type { SpaceGrant } from "../../../../../webapp/src/services/spaces.service";
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
test("web promotion reconnects muted and demotion removes publishing, without camera calls", async () => {
  MockWebRoom.created = [];
  const listener: SpaceGrant = {
    spaceId: "s",
    role: "listener",
    canPublish: false,
    url: "wss://audio.test",
    token: "listener",
  };
  const speaker: SpaceGrant = {
    ...listener,
    role: "speaker",
    canPublish: true,
    token: "speaker",
  };
  const { result, rerender } = await renderHook(
    ({ grant }: { grant: SpaceGrant }) => useSpaceAudio(grant),
    { initialProps: { grant: listener } },
  );
  await act(async () => flush());
  await act(async () => result.current.toggle());
  expect(MockWebRoom.created[0]!.setMicrophoneEnabled).not.toHaveBeenCalled();
  await rerender({ grant: speaker });
  await act(async () => flush());
  expect(MockWebRoom.created[0]!.disconnect).toHaveBeenCalled();
  expect(result.current.muted).toBe(true);
  expect(MockWebRoom.created[1]!.setMicrophoneEnabled).not.toHaveBeenCalled();
  await act(async () => result.current.toggle());
  expect(MockWebRoom.created[1]!.setMicrophoneEnabled).toHaveBeenCalledWith(
    true,
  );
  await rerender({ grant: listener });
  await act(async () => flush());
  expect(MockWebRoom.created[1]!.disconnect).toHaveBeenCalled();
  expect(result.current.muted).toBe(true);
  await act(async () => result.current.toggle());
  expect(MockWebRoom.created[2]!.setMicrophoneEnabled).not.toHaveBeenCalled();
});
