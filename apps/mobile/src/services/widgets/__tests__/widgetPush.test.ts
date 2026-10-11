type PushService = typeof import("../widgetPush.service");

interface Harness {
  readonly service: PushService;
  readonly notifications: { getExpoPushTokenAsync: jest.Mock; addNotificationReceivedListener: jest.Mock; registerTaskAsync: jest.Mock };
  readonly api: { post: jest.Mock; delete: jest.Mock };
  readonly storage: Map<string, string>;
  readonly defineTask: jest.Mock;
}

function load(environment: string, platform = "ios"): Harness {
  const storage = new Map<string, string>();
  const notifications = {
    getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[abc]" })),
    addNotificationReceivedListener: jest.fn(),
    registerTaskAsync: jest.fn(async () => undefined),
  };
  const api = { post: jest.fn(async () => undefined), delete: jest.fn(async () => undefined) };
  const defineTask = jest.fn();
  let service: PushService | undefined;
  jest.isolateModules(() => {
    jest.doMock("react-native", () => ({ Platform: { OS: platform } }));
    jest.doMock("expo-constants", () => ({ __esModule: true, default: { executionEnvironment: environment, expoConfig: { extra: { eas: { projectId: "project-1" } } } }, ExecutionEnvironment: { StoreClient: "storeClient", Standalone: "standalone", Bare: "bare" } }));
    jest.doMock("expo-task-manager", () => ({ isTaskDefined: () => false, defineTask }));
    jest.doMock("expo-notifications", () => notifications);
    jest.doMock("@/services/apiClient.service", () => ({ api }));
    jest.doMock("@react-native-async-storage/async-storage", () => ({ __esModule: true, default: {
      getItem: async (key: string) => storage.get(key) ?? null, setItem: async (key: string, value: string) => void storage.set(key, value), removeItem: async (key: string) => void storage.delete(key),
    } }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    service = require("../widgetPush.service") as PushService;
  });
  return { service: service!, notifications, api, storage, defineTask };
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

describe("widget push registration", () => {
  afterEach(() => jest.resetModules());

  it("does nothing in Expo Go", async () => {
    const { service, notifications, api, defineTask } = load("storeClient");
    await service.startWidgetRefreshPush();
    await service.unregisterDeviceFromWidgetPush();
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    expect(defineTask).not.toHaveBeenCalled();
  });

  it("registers the device once, listens for data messages and removes the token on sign-out", async () => {
    const { service, notifications, api, storage, defineTask } = load("standalone", "android");
    expect(defineTask).toHaveBeenCalledWith("zudomart-widget-refresh-push", expect.any(Function));
    await service.startWidgetRefreshPush();
    await service.startWidgetRefreshPush();
    expect(notifications.registerTaskAsync).toHaveBeenCalledTimes(1);
    expect(notifications.addNotificationReceivedListener).toHaveBeenCalledTimes(1);
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "project-1" });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith("/api/v1/notifications/device-tokens", { token: "ExponentPushToken[abc]", platform: "android" });
    await service.unregisterDeviceFromWidgetPush();
    expect(api.delete).toHaveBeenCalledWith("/api/v1/notifications/device-tokens", { body: { token: "ExponentPushToken[abc]" } });
    expect(storage.size).toBe(0);
  });

  it("skips registration quietly when no push token can be obtained", async () => {
    const { service, notifications, api } = load("standalone");
    notifications.getExpoPushTokenAsync.mockRejectedValueOnce(new Error("no permission"));
    await expect(service.startWidgetRefreshPush()).resolves.toBeUndefined();
    expect(api.post).not.toHaveBeenCalled();
  });
});
