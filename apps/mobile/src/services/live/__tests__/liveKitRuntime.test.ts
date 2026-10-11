const loadRuntime = (options: { mocks: boolean; nativeModules: Record<string, unknown>; environment?: string }) => {
  jest.resetModules();
  const required: string[] = [];
  jest.doMock("expo-constants", () => ({ __esModule: true, default: { executionEnvironment: options.environment ?? "bare" }, ExecutionEnvironment: { StoreClient: "storeClient" } }));
  jest.doMock("react-native", () => ({ Platform: { OS: "ios" }, NativeModules: options.nativeModules, TurboModuleRegistry: { get: (name: string) => options.nativeModules[name] ?? null } }));
  jest.doMock("@/config/api.config", () => ({ shouldUseMockForPath: () => options.mocks }));
  jest.doMock("@livekit/react-native", () => {
    required.push("@livekit/react-native");
    return { registerGlobals: () => required.push("registerGlobals") };
  });
  jest.doMock("livekit-client", () => {
    required.push("livekit-client");
    return { Room: class {}, VideoPreset: class {} };
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const runtime = require("../liveKitRuntime.service") as typeof import("../liveKitRuntime.service");
  return { runtime, required };
};

describe("LiveKit runtime loading", () => {
  afterEach(() => jest.dontMock("react-native"));

  it("never loads the native SDK in Expo Go", () => {
    const { runtime, required } = loadRuntime({ mocks: false, nativeModules: {}, environment: "storeClient" });
    expect(runtime.loadLiveKitRuntime()).toBeNull();
    expect(required).toEqual([]);
  });

  it("keeps mock mode a camera preview even in a dev build", () => {
    const { runtime, required } = loadRuntime({ mocks: true, nativeModules: { WebRTCModule: {} } });
    expect(runtime.isLiveVideoPreviewOnly()).toBe(true);
    expect(runtime.loadLiveKitRuntime()).toBeNull();
    expect(required).toEqual([]);
  });

  it("registers the WebRTC globals once before using the client in a dev build", () => {
    const { runtime, required } = loadRuntime({ mocks: false, nativeModules: { WebRTCModule: {} } });
    const first = runtime.loadLiveKitRuntime();
    expect(first).not.toBeNull();
    expect(runtime.loadLiveKitRuntime()).toBe(first);
    expect(required).toEqual(["@livekit/react-native", "registerGlobals", "livekit-client"]);
  });
});
