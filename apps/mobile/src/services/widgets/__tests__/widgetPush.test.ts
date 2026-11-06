type PushService = typeof import("../widgetPush.service");
const pushTokenStorageKey = "zm.widget.pushToken";

interface Harness {
  readonly service: PushService;
  readonly notifications: {
    getExpoPushTokenAsync: jest.Mock;
    getPermissionsAsync: jest.Mock;
    requestPermissionsAsync: jest.Mock;
    addNotificationReceivedListener: jest.Mock;
    registerTaskAsync: jest.Mock;
  };
  readonly api: { post: jest.Mock; delete: jest.Mock };
  readonly storage: Map<string, string>;
  readonly defineTask: jest.Mock;
  readonly signOutHooks: Array<() => Promise<void>>;
  readonly fetchSettings: jest.Mock;
  readonly appStateListener: { current: string };
}

function load(environment: string, platform = "ios"): Harness {
  const storage = new Map<string, string>();
  const signOutHooks: Array<() => Promise<void>> = [];
  const appStateListener = { current: "active" };
  const notifications = {
    getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[abc]" })),
    getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true, status: "granted" })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true, status: "granted" })),
    addNotificationReceivedListener: jest.fn(),
    registerTaskAsync: jest.fn(async () => undefined),
  };
  const api = { post: jest.fn(async () => undefined), delete: jest.fn(async () => undefined) };
  const defineTask = jest.fn();
  const fetchSettings = jest.fn(async () => ({ pushNotificationsEnabled: true }));
  let service: PushService | undefined;
  jest.isolateModules(() => {
    jest.doMock("react-native", () => ({
      Platform: { OS: platform },
      AppState: { addEventListener: jest.fn((_event: string, listener: (state: string) => void) => { appStateListener.current = "active"; (appStateListener as { listener?: (state: string) => void }).listener = listener; return { remove: jest.fn() }; }) },
    }));
    jest.doMock("expo-constants", () => ({ __esModule: true, default: { executionEnvironment: environment, expoConfig: { extra: { eas: { projectId: "project-1" } } }, easConfig: undefined }, ExecutionEnvironment: { StoreClient: "storeClient", Standalone: "standalone", Bare: "bare" } }));
    jest.doMock("expo-task-manager", () => ({ isTaskDefined: () => false, defineTask }));
    jest.doMock("expo-notifications", () => notifications);
    jest.doMock("@/services/apiClient.service", () => ({ api }));
    jest.doMock("@/services/account/users.service", () => ({ usersService: { fetchMyAccountSettings: fetchSettings } }));
    jest.doMock("@/store/auth.store", () => ({ registerSignOutHook: (hook: () => Promise<void>) => { signOutHooks.push(hook); return () => undefined; } }));
    jest.doMock("@react-native-async-storage/async-storage", () => ({ __esModule: true, default: {
      getItem: async (key: string) => storage.get(key) ?? null,
      setItem: async (key: string, value: string) => void storage.set(key, value),
      removeItem: async (key: string) => void storage.delete(key),
    } }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    service = require("../widgetPush.service") as PushService;
  });
  return { service: service!, notifications, api, storage, defineTask, signOutHooks, fetchSettings, appStateListener };
}

describe("widget refresh push payloads", () => {
  const { service } = load("standalone");

  it("reads the refresh request from every shape expo-notifications delivers", () => {
    expect(service.readWidgetRefreshKinds({ type: "widgetRefresh", widgets: ["orders"] })).toEqual(["orders"]);
    expect(service.readWidgetRefreshKinds({ data: { dataString: JSON.stringify({ type: "widgetRefresh", widgets: ["stories"] }) } })).toEqual(["stories"]);
    expect(service.readWidgetRefreshKinds({ data: { body: { type: "widgetRefresh", widgets: ["liveNow"] } } })).toEqual(["liveNow"]);
    expect(service.readWidgetRefreshKinds({ notification: { request: { content: { data: { type: "widgetRefresh", widgets: ["sellerToday"] } } } } })).toEqual(["sellerToday"]);
  });

  it("ignores other notifications and unknown widget names", () => {
    expect(service.readWidgetRefreshKinds({ data: { orderId: "o1" } })).toBeNull();
    expect(service.readWidgetRefreshKinds({ data: { dataString: "{broken" } })).toBeNull();
    expect(service.readWidgetRefreshKinds(null)).toBeNull();
    expect(service.readWidgetRefreshKinds({ type: "widgetRefresh", widgets: ["admin"] })).toEqual(["orders", "sellerToday", "liveNow", "creatorToday", "stories"]);
  });
});

describe("account push consent and Expo token lifecycle", () => {
  afterEach(() => jest.resetModules());

  it("keeps silent widget-task setup independent from permission and token registration", async () => {
    const { service, notifications, api, defineTask } = load("standalone", "android");
    expect(defineTask).toHaveBeenCalledWith("nantty-widget-refresh-push", expect.any(Function));
    await service.startWidgetRefreshTask();
    expect(notifications.registerTaskAsync).toHaveBeenCalledTimes(1);
    expect(notifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("requests permission on the explicit enable action and registers the Expo token", async () => {
    const { service, notifications, api, storage } = load("standalone", "android");
    notifications.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true, status: "undetermined" });

    const savePreference = jest.fn(async () => undefined);
    await expect(service.enableAccountPushNotifications(savePreference)).resolves.toBe("granted");

    expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(savePreference).toHaveBeenCalledWith(true);
    expect(api.post).toHaveBeenCalledWith("/api/v1/notifications/device-tokens", { token: "ExponentPushToken[abc]", platform: "android" });
    expect(storage.get(pushTokenStorageKey)).toBe("ExponentPushToken[abc]");
  });

  it("does not register or call the backend when OS permission is denied", async () => {
    const { service, notifications, api, storage } = load("standalone");
    notifications.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true, status: "undetermined" });
    notifications.requestPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false, status: "denied" });

    const savePreference = jest.fn(async () => undefined);
    await expect(service.enableAccountPushNotifications(savePreference)).resolves.toBe("denied");

    expect(savePreference).not.toHaveBeenCalled();
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    expect(storage.has(pushTokenStorageKey)).toBe(false);
  });

  it("surfaces registration API failures and does not persist an unregistered token", async () => {
    const { service, api, storage } = load("standalone");
    api.post.mockRejectedValueOnce(new Error("server unavailable"));

    const savePreference = jest.fn(async () => undefined);
    await expect(service.enableAccountPushNotifications(savePreference)).rejects.toThrow("server unavailable");
    expect(savePreference.mock.calls).toEqual([[true], [false]]);
    expect(storage.has(pushTokenStorageKey)).toBe(false);
  });

  it("unregisters the device token after account opt-out and during sign-out", async () => {
    const { service, api, storage, signOutHooks } = load("standalone");
    storage.set(pushTokenStorageKey, "ExponentPushToken[abc]");

    const savePreference = jest.fn(async () => undefined);
    await service.disableAccountPushNotifications(savePreference);
    expect(savePreference).toHaveBeenCalledWith(false);
    expect(api.delete).toHaveBeenCalledWith("/api/v1/notifications/device-tokens", { body: { token: "ExponentPushToken[abc]" } });
    expect(storage.has(pushTokenStorageKey)).toBe(false);

    storage.set(pushTokenStorageKey, "ExponentPushToken[second]");
    await signOutHooks[0]!();
    expect(api.delete).toHaveBeenLastCalledWith("/api/v1/notifications/device-tokens", { body: { token: "ExponentPushToken[second]" } });
    expect(storage.has(pushTokenStorageKey)).toBe(false);
  });

  it("retains the token locally when backend deregistration fails so it can be retried", async () => {
    const { service, api, storage } = load("standalone");
    storage.set(pushTokenStorageKey, "ExponentPushToken[abc]");
    api.delete.mockRejectedValueOnce(new Error("network unavailable"));

    await service.unregisterDeviceFromWidgetPush();
    expect(storage.get(pushTokenStorageKey)).toBe("ExponentPushToken[abc]");
    await service.unregisterDeviceFromWidgetPush();
    expect(storage.has(pushTokenStorageKey)).toBe(false);
  });

  it("removes a rotated token before registering its replacement", async () => {
    const { service, notifications, api, storage } = load("standalone");
    storage.set(pushTokenStorageKey, "ExponentPushToken[old]");
    notifications.getExpoPushTokenAsync.mockResolvedValueOnce({ data: "ExponentPushToken[new]" });

    await service.enableAccountPushNotifications(async () => undefined);

    expect(api.delete).toHaveBeenCalledWith("/api/v1/notifications/device-tokens", { body: { token: "ExponentPushToken[old]" } });
    expect(api.post).toHaveBeenCalledWith("/api/v1/notifications/device-tokens", { token: "ExponentPushToken[new]", platform: "ios" });
    expect(storage.get(pushTokenStorageKey)).toBe("ExponentPushToken[new]");
  });

  it("does not silently prompt during an account lifecycle permission recheck", async () => {
    const { service, notifications, fetchSettings, api } = load("standalone");
    notifications.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true, status: "denied" });

    await service.syncAccountPushRegistrationForCurrentAccount();

    expect(fetchSettings).toHaveBeenCalledTimes(1);
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });
});
