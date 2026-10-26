import { type VoiceNoteSession, idleVoiceNoteSession } from "@nantty/chat-crypto";
import { createElement, Fragment } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { VoiceNoteBubble } from "../voiceNoteBubble";
import { VoiceNoteRecordingPill } from "../voiceNoteRecordingPill";

jest.setTimeout(30_000);

const mockPlayers: { pause: jest.Mock; play: jest.Mock; replace: jest.Mock; seekTo: jest.Mock; setPlaybackRate: jest.Mock }[] = [];

jest.mock("expo-audio", () => ({
  useAudioPlayer: () => {
    const { useRef } = jest.requireActual("react");
    const player = useRef(null);
    if (!player.current) {
      player.current = { pause: jest.fn(), play: jest.fn(), replace: jest.fn(), seekTo: jest.fn(async () => undefined), setPlaybackRate: jest.fn() };
      mockPlayers.push(player.current);
    }
    return player.current;
  },
  useAudioPlayerStatus: () => ({ playing: false, currentTime: 0, duration: 0, didJustFinish: false }),
}));
jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  const identity = () => () => 0;
  return {
    __esModule: true,
    default: { View },
    Easing: { bezier: identity, linear: (value: number) => value, inOut: identity, ease: (value: number) => value },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: () => ({}),
    withTiming: (value: number) => value,
    withRepeat: (value: number) => value,
    withSequence: (value: number) => value,
    cancelAnimation: () => undefined,
  };
});
jest.mock("@/components/media/uploadProgressBar", () => ({ UploadProgressBar: () => null }));

const voiceMedia = (id: string) => ({ id, type: "voice" as const, url: `https://media.example/${id}`, durationSeconds: 12 });

beforeEach(() => {
  mockPlayers.length = 0;
});

describe("VoiceNoteBubble", () => {
  test("labels play with the duration and pauses the first voice note when a second starts", async () => {
    await render(
      createElement(Fragment, null,
        createElement(VoiceNoteBubble, { media: voiceMedia("first"), waveformPeaks: Array(48).fill(128), isMine: true, deliveryStatus: "sent" }),
        createElement(VoiceNoteBubble, { media: voiceMedia("second"), isMine: false, deliveryStatus: "sent" }),
      ),
    );
    const playButtons = screen.getAllByLabelText("Play voice note, 0:12");
    expect(playButtons).toHaveLength(2);
    await fireEvent.press(playButtons[0]!);
    expect(mockPlayers[0]!.play).toHaveBeenCalled();
    expect(mockPlayers[0]!.replace).toHaveBeenCalledWith({ uri: "https://media.example/first" });
    await fireEvent.press(playButtons[1]!);
    expect(mockPlayers[1]!.play).toHaveBeenCalled();
    expect(mockPlayers[0]!.pause).toHaveBeenCalled();
  });

  test("cycles playback speed 1×, 1.5×, 2× and applies it to the player", async () => {
    await render(createElement(VoiceNoteBubble, { media: voiceMedia("speed"), isMine: false, deliveryStatus: "sent" }));
    await fireEvent.press(screen.getByLabelText("Playback speed 1×"));
    expect(mockPlayers[0]!.setPlaybackRate).toHaveBeenLastCalledWith(1.5);
    await fireEvent.press(screen.getByLabelText("Playback speed 1.5×"));
    await fireEvent.press(screen.getByLabelText("Playback speed 2×"));
    expect(screen.getByLabelText("Playback speed 1×")).toBeTruthy();
  });

  test("stays inert while the voice note is still decrypting", async () => {
    await render(createElement(VoiceNoteBubble, { media: { ...voiceMedia("pending"), url: null }, isMine: true, deliveryStatus: "pending" }));
    const play = screen.getByLabelText("Play voice note, 0:12");
    expect(play.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(play);
    expect(mockPlayers[0]!.play).not.toHaveBeenCalled();
  });
});

const recording = (overrides: Partial<VoiceNoteSession>): VoiceNoteSession => ({ ...idleVoiceNoteSession, phase: "recording", startedAtMs: 0, elapsedMs: 4_000, levels: [0.2, 0.5], ...overrides });
const pillProps = { previewFile: null, availableWidth: 360, reduceMotion: true, onStop: jest.fn(), onStopAndSend: jest.fn(), onDiscard: jest.fn(), onSendPreview: jest.fn() };

describe("VoiceNoteRecordingPill", () => {
  test("asks to slide to cancel, then to release once armed", async () => {
    const view = await render(createElement(VoiceNoteRecordingPill, { ...pillProps, session: recording({}) }));
    expect(screen.getByText("‹ Slide to cancel")).toBeTruthy();
    expect(screen.getByLabelText("Recording. Release to keep, slide left to discard.")).toBeTruthy();
    await view.rerender(createElement(VoiceNoteRecordingPill, { ...pillProps, session: recording({ dragLeftPx: 95 }) }));
    expect(screen.getByText("Release to cancel")).toBeTruthy();
  });

  test("offers stop and send controls when recording hands-free", async () => {
    const onStop = jest.fn();
    const onStopAndSend = jest.fn();
    await render(createElement(VoiceNoteRecordingPill, { ...pillProps, onStop, onStopAndSend, session: recording({ mode: "tap" }) }));
    expect(screen.queryByText("‹ Slide to cancel")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Stop recording and listen"));
    await fireEvent.press(screen.getByLabelText("Send voice note"));
    expect(onStop).toHaveBeenCalled();
    expect(onStopAndSend).toHaveBeenCalled();
  });

  test("previews with play, discard and send", async () => {
    const onDiscard = jest.fn();
    const onSendPreview = jest.fn();
    const previewFile = { uri: "file:///clip.m4a", mediaType: "audio" as const, mimeType: "audio/mp4", fileName: "clip.m4a", sizeBytes: null, width: null, height: null, durationSeconds: 4 };
    await render(createElement(VoiceNoteRecordingPill, { ...pillProps, previewFile, onDiscard, onSendPreview, session: recording({ phase: "preview" }) }));
    await fireEvent.press(screen.getByLabelText("Play voice note, 0:04"));
    expect(mockPlayers[0]!.replace).toHaveBeenCalledWith({ uri: "file:///clip.m4a" });
    await fireEvent.press(screen.getByLabelText("Send voice note"));
    expect(onSendPreview).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Discard voice note"));
    expect(onDiscard).toHaveBeenCalled();
  });
});
