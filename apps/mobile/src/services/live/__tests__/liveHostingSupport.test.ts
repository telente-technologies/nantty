const loadSupport = (environment: string, platform: "ios" | "android" | "web", nativeModules: Record<string, unknown> = {}) => {
  jest.resetModules();
  jest.doMock("expo-constants", () => ({ __esModule: true, default: { executionEnvironment: environment }, ExecutionEnvironment: { StoreClient: "storeClient", Standalone: "standalone", Bare: "bare" } }));
  jest.doMock("react-native", () => ({ Platform: { OS: platform }, NativeModules: nativeModules, TurboModuleRegistry: { get: (name: string) => nativeModules[name] ?? null } }));
  jest.doMock("@/config/api.config", () => ({ shouldUseMockForPath: () => true }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("../liveHostingSupport.service") as typeof import("../liveHostingSupport.service");
};

describe("live hosting support", () => {
  afterEach(() => jest.dontMock("react-native"));

  it("detects Expo Go and gates camera and screen lives, but not encoder lives", () => {
    const support = loadSupport("storeClient", "ios");
    expect(support.detectLiveHostingSupport()).toBe("expoGo");
    expect(support.decideLiveHostingGate("expoGo", "camera", false)).toBe("expoGo");
    expect(support.decideLiveHostingGate("expoGo", "screen", false)).toBe("expoGo");
    expect(support.decideLiveHostingGate("expoGo", "external", false)).toBeNull();
  });

  it("lets the owner preview the live screens with mock data after the gate", () => {
    const support = loadSupport("storeClient", "android");
    expect(support.canPreviewLiveHostingWithMocks()).toBe(true);
    expect(support.decideLiveHostingGate("expoGo", "camera", true)).toBeNull();
  });

  it("does not gate a dev build, and reports whether the video engine is linked", () => {
    expect(loadSupport("bare", "ios").detectLiveHostingSupport()).toBe("noVideoEngine");
    expect(loadSupport("bare", "ios", { WebRTCModule: {} }).detectLiveHostingSupport()).toBe("ready");
    expect(loadSupport("standalone", "web").detectLiveHostingSupport()).toBe("web");
    expect(loadSupport("bare", "ios").decideLiveHostingGate("noVideoEngine", "camera", false)).toBeNull();
  });
});
