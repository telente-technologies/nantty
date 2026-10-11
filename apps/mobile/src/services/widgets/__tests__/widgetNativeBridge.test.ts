type Bridge = typeof import("../widgetNativeBridge.service");

function loadBridge(platform: string, environment: string, appleTargets: () => unknown, secureStore = { setItemAsync: jest.fn(), deleteItemAsync: jest.fn(), getItemAsync: jest.fn(), AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1 }): Bridge {
  let bridge: Bridge | undefined;
  jest.isolateModules(() => {
    jest.doMock("react-native", () => ({ Platform: { OS: platform } }));
    jest.doMock("expo-constants", () => ({ __esModule: true, default: { executionEnvironment: environment }, ExecutionEnvironment: { StoreClient: "storeClient", Standalone: "standalone", Bare: "bare" } }));
    jest.doMock("expo-secure-store", () => secureStore);
    jest.doMock("@react-native-async-storage/async-storage", () => ({ __esModule: true, default: { setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn() } }));
    jest.doMock("@bacons/apple-targets", appleTargets);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    bridge = require("../widgetNativeBridge.service") as Bridge;
  });
  return bridge!;
}

describe("widget native bridge", () => {
  afterEach(() => jest.resetModules());

  it("is a safe no-op in Expo Go and never loads the native widget modules", async () => {
    const loader = jest.fn(() => ({ ExtensionStorage: jest.fn() }));
    const secureStore = { setItemAsync: jest.fn(), deleteItemAsync: jest.fn(), getItemAsync: jest.fn(), AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1 };
    const bridge = loadBridge("ios", "storeClient", loader, secureStore);
    expect(bridge.areHomeScreenWidgetsSupported()).toBe(false);
    await bridge.writeWidgetSharedValue("k", "v");
    await bridge.writeWidgetSecret("zm.widgetToken", "secret");
    await bridge.reloadHomeScreenWidgets();
    expect(await bridge.readWidgetSecret("zm.widgetToken")).toBeNull();
    expect(loader).not.toHaveBeenCalled();
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("stores the widget token in the shared App Group keychain, readable after first unlock only on this device", async () => {
    const storage = { set: jest.fn(), get: jest.fn(), remove: jest.fn() };
    const ExtensionStorage = Object.assign(jest.fn(() => storage), { reloadWidget: jest.fn() });
    const secureStore = { setItemAsync: jest.fn(), deleteItemAsync: jest.fn(), getItemAsync: jest.fn(), AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 };
    const bridge = loadBridge("ios", "standalone", () => ({ ExtensionStorage }), secureStore);
    await bridge.writeWidgetSecret("zm.widgetToken", "secret");
    expect(secureStore.setItemAsync).toHaveBeenCalledWith("zm.widgetToken", "secret", { keychainService: "zudomart.widgets", accessGroup: "group.com.zudomart.app", keychainAccessible: 7 });
    await bridge.writeWidgetSharedValue("zm.widget.session", "{}");
    expect(ExtensionStorage).toHaveBeenCalledWith("group.com.zudomart.app");
    expect(storage.set).toHaveBeenCalledWith("zm.widget.session", "{}");
    await bridge.reloadHomeScreenWidgets(["orders"]);
    expect(ExtensionStorage.reloadWidget).toHaveBeenCalledWith("ZudomartOrdersWidget");
  });

  it("does not crash when a build lacks the widget extension module", async () => {
    const bridge = loadBridge("ios", "standalone", () => { throw new Error("missing"); });
    await expect(bridge.writeWidgetSharedValue("k", "v")).resolves.toBeUndefined();
    await expect(bridge.reloadHomeScreenWidgets()).resolves.toBeUndefined();
  });
});
