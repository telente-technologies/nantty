import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";

import { useVoiceNoteRecorder } from "../voiceNoteRecorder.hook";

const mockRecorder = {
  isRecordingNow: false,
  uri: "file:///voice.m4a" as string | null,
  prepareToRecordAsync: jest.fn(async () => undefined),
  record: jest.fn(() => {
    mockRecorder.isRecordingNow = true;
  }),
  stop: jest.fn(async () => {
    mockRecorder.isRecordingNow = false;
  }),
  getStatus: jest.fn(() => ({ isRecording: mockRecorder.isRecordingNow, metering: -20, durationMillis: 0 })),
};
const mockRequestPermission = jest.fn(async () => ({ granted: true }));

jest.mock("expo-audio", () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: () => mockRequestPermission(),
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: () => mockRecorder,
}));
jest.mock("expo-haptics", () => ({ impactAsync: jest.fn(async () => undefined), ImpactFeedbackStyle: { Light: "light" } }));
const mockShowAlert = jest.fn();
jest.mock("@/utils/crossPlatformAlert.util", () => ({ showAlertWithButtons: (...args: unknown[]) => mockShowAlert(...args) }));

const appStateListeners: ((state: string) => void)[] = [];
jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, listener: (state: string) => void) => {
  appStateListeners.push(listener);
  return { remove: () => appStateListeners.splice(appStateListeners.indexOf(listener), 1) };
}) as never);

const flush = async () => {
  for (let index = 0; index < 5; index++) await Promise.resolve();
};

async function startRecording(onFinished = jest.fn()) {
  const hook = await renderHook(() => useVoiceNoteRecorder(onFinished, false));
  await act(async () => {
    await hook.result.current.press();
  });
  return { hook, onFinished };
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date("2026-10-17T10:00:00Z") });
  jest.clearAllMocks();
  mockRecorder.isRecordingNow = false;
  mockRequestPermission.mockImplementation(async () => ({ granted: true }));
});

afterEach(() => jest.useRealTimers());

describe("useVoiceNoteRecorder", () => {
  test("records real metering levels and opens a preview that sends 48 peaks", async () => {
    const { hook, onFinished } = await startRecording();
    expect(hook.result.current.session.phase).toBe("recording");
    await act(async () => {
      jest.advanceTimersByTime(1_400);
    });
    expect(hook.result.current.session.levels.length).toBeGreaterThanOrEqual(19);
    expect(hook.result.current.session.levels[0]).toBeCloseTo(35 / 55);
    await act(async () => {
      hook.result.current.release();
      await flush();
    });
    expect(mockRecorder.stop).toHaveBeenCalled();
    expect(hook.result.current.session.phase).toBe("preview");
    expect(hook.result.current.previewFile?.uri).toBe("file:///voice.m4a");
    await act(async () => hook.result.current.sendPreview());
    expect(onFinished).toHaveBeenCalledTimes(1);
    const sent = onFinished.mock.calls[0][0];
    expect(sent.waveform).toHaveLength(48);
    expect(sent.waveform.every((peak: number) => Number.isInteger(peak) && peak >= 0 && peak <= 255)).toBe(true);
    expect(sent.file.durationSeconds).toBeCloseTo(1.4, 1);
    expect(hook.result.current.session.phase).toBe("idle");
  });

  test("shows the microphone alert and stays idle when permission is denied", async () => {
    mockRequestPermission.mockImplementation(async () => ({ granted: false }));
    const { hook } = await startRecording();
    expect(mockShowAlert).toHaveBeenCalledWith("Microphone needed", expect.any(String), undefined, { intent: "microphone" });
    expect(mockRecorder.record).not.toHaveBeenCalled();
    expect(hook.result.current.session.phase).toBe("idle");
  });

  test("ignores a double press while the first is still preparing", async () => {
    let grant: (value: { granted: boolean }) => void = () => undefined;
    mockRequestPermission.mockImplementation(() => new Promise((resolve) => (grant = resolve)));
    const hook = await renderHook(() => useVoiceNoteRecorder(jest.fn(), false));
    await act(async () => {
      void hook.result.current.press();
      void hook.result.current.press();
      await flush();
    });
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    await act(async () => {
      grant({ granted: true });
      await flush();
    });
    expect(mockRecorder.record).toHaveBeenCalledTimes(1);
  });

  test("never starts the microphone when released or cancelled before recording began", async () => {
    for (const abandon of ["release", "cancel"] as const) {
      jest.clearAllMocks();
      let grant: (value: { granted: boolean }) => void = () => undefined;
      mockRequestPermission.mockImplementation(() => new Promise((resolve) => (grant = resolve)));
      const hook = await renderHook(() => useVoiceNoteRecorder(jest.fn(), false));
      await act(async () => {
        void hook.result.current.press();
        await flush();
        hook.result.current[abandon]();
        grant({ granted: true });
        await flush();
      });
      expect(mockRecorder.record).not.toHaveBeenCalled();
      expect(hook.result.current.session.phase).toBe("idle");
    }
  });

  test("discards a clip under half a second and offers hands-free recording", async () => {
    const { hook, onFinished } = await startRecording();
    await act(async () => {
      jest.advanceTimersByTime(300);
      hook.result.current.release();
      await flush();
    });
    expect(hook.result.current.session.phase).toBe("discarding");
    await act(async () => {
      jest.advanceTimersByTime(360);
    });
    expect(hook.result.current.session.phase).toBe("idle");
    expect(hook.result.current.session.handsFreeOfferedUntilMs).toBeGreaterThan(Date.now());
    expect(onFinished).not.toHaveBeenCalled();
    await act(async () => {
      await hook.result.current.press();
    });
    expect(hook.result.current.session.mode).toBe("tap");
  });

  test("keeps the clip when the app goes to the background mid-recording", async () => {
    const { hook } = await startRecording();
    await act(async () => {
      jest.advanceTimersByTime(2_000);
      appStateListeners.forEach((listener) => listener("background"));
      await flush();
    });
    expect(mockRecorder.stop).toHaveBeenCalled();
    expect(hook.result.current.session.phase).toBe("preview");
  });

  test("auto-stops at the 300 second maximum", async () => {
    const { hook } = await startRecording();
    await act(async () => {
      jest.setSystemTime(Date.now() + 300_000);
      jest.advanceTimersByTime(70);
      await flush();
    });
    expect(hook.result.current.session).toMatchObject({ phase: "preview", elapsedMs: 300_000 });
    expect(mockRecorder.stop).toHaveBeenCalled();
  });

  test("discards when released after sliding past the cancel distance", async () => {
    const { hook, onFinished } = await startRecording();
    await act(async () => {
      jest.advanceTimersByTime(2_000);
      hook.result.current.drag(120);
      hook.result.current.release();
      await flush();
    });
    expect(hook.result.current.session).toMatchObject({ phase: "discarding", discardReason: "cancelled" });
    expect(onFinished).not.toHaveBeenCalled();
  });

  test("tap mode stops and sends straight from the send button", async () => {
    const onFinished = jest.fn();
    const hook = await renderHook(() => useVoiceNoteRecorder(onFinished, false));
    await act(async () => {
      await hook.result.current.press("tap");
      jest.advanceTimersByTime(1_000);
      hook.result.current.release();
    });
    expect(hook.result.current.session.phase).toBe("recording");
    await act(async () => {
      hook.result.current.stopAndSend();
      await flush();
    });
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(hook.result.current.session.phase).toBe("idle");
  });
});
