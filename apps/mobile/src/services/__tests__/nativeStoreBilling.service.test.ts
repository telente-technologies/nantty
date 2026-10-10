type Availability = import("../money/nativeStoreBilling.service").StoreBillingAvailability;

function resolveWith(platform: string, environment: string, expoIap: () => unknown): { availability: Availability; channel: string } {
  let result: { availability: Availability; channel: string } | undefined;
  jest.isolateModules(() => {
    jest.doMock("react-native", () => ({ Platform: { OS: platform } }));
    jest.doMock("expo-constants", () => ({ __esModule: true, default: { executionEnvironment: environment }, ExecutionEnvironment: { StoreClient: "storeClient", Standalone: "standalone", Bare: "bare" } }));
    jest.doMock("expo-iap", expoIap);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const service = require("../money/nativeStoreBilling.service") as typeof import("../money/nativeStoreBilling.service");
    result = { availability: service.resolveStoreBillingAvailability(), channel: service.storeBillingChannel() };
  });
  return result!;
}

describe("store billing availability", () => {
  afterEach(() => jest.resetModules());

  it("never loads the native module in Expo Go and asks for the app build", () => {
    const loader = jest.fn(() => ({ requestPurchase: jest.fn() }));
    const { availability, channel } = resolveWith("ios", "storeClient", loader);
    expect(availability.kind).toBe("needsAppBuild");
    expect(channel).toBe("web");
    expect(loader).not.toHaveBeenCalled();
  });

  it("does not crash when a build lacks the native module", () => {
    const { availability } = resolveWith("android", "standalone", () => {
      throw new Error("Cannot find native module 'ExpoIap'");
    });
    expect(availability.kind).toBe("needsAppBuild");
  });

  it("is ready in a development or store build with expo-iap linked", () => {
    const { availability, channel } = resolveWith("android", "bare", () => ({ requestPurchase: jest.fn() }));
    expect(availability.kind).toBe("ready");
    expect(channel).toBe("android");
  });

  it("keeps web checkout on the web", () => {
    expect(resolveWith("web", "bare", () => ({ requestPurchase: jest.fn() })).availability.kind).toBe("web");
  });
});
