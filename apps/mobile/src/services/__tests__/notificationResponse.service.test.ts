type NotificationResponseService = typeof import("../notificationResponse.service");

type FakeResponse = {
  readonly actionIdentifier: string;
  readonly notification: { readonly request: { readonly identifier: string; readonly content: { readonly data: unknown } } };
};

function load(lastResponse: FakeResponse | null = null) {
  let onResponse: ((response: FakeResponse) => void) | undefined;
  const remove = jest.fn();
  const clearLastNotificationResponseAsync = jest.fn(async () => undefined);
  const notifications = {
    addNotificationResponseReceivedListener: jest.fn((listener: (response: FakeResponse) => void) => {
      onResponse = listener;
      return { remove };
    }),
    getLastNotificationResponseAsync: jest.fn(async () => lastResponse),
    clearLastNotificationResponseAsync,
  };
  let service: NotificationResponseService | undefined;
  jest.isolateModules(() => {
    jest.doMock("expo-notifications", () => notifications);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    service = require("../notificationResponse.service") as NotificationResponseService;
  });
  return { service: service!, notifications, emit: (response: FakeResponse) => onResponse?.(response), remove };
}

const response = (url: string, identifier = "push-1"): FakeResponse => ({
  actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
  notification: { request: { identifier, content: { data: { url } } } },
});

describe("notification response routing", () => {
  afterEach(() => jest.resetModules());

  it("deduplicates foreground and cold-start responses and waits for navigation acknowledgement before clearing", async () => {
    const coldResponse = response("/post/post_42");
    const { service, notifications, emit, remove } = load(coldResponse);
    const onRoute = jest.fn();
    const unsubscribe = service.subscribeToNotificationResponses(onRoute);

    emit(coldResponse);
    await Promise.resolve();
    await Promise.resolve();

    expect(onRoute).toHaveBeenCalledTimes(1);
    expect(notifications.clearLastNotificationResponseAsync).not.toHaveBeenCalled();
    await service.clearHandledNotificationResponse();
    expect(notifications.clearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("routes a foreground response and ignores external or unmapped links", () => {
    const { service, emit } = load();
    const onRoute = jest.fn();
    service.subscribeToNotificationResponses(onRoute);

    emit(response("https://attacker.example/phishing", "external"));
    emit(response("/unmapped/private-screen", "unmapped"));
    emit(response("/orders/order_42", "order"));

    expect(onRoute).toHaveBeenCalledTimes(1);
    expect(onRoute.mock.calls[0]?.[0].routes[0]?.name).toBe("OrderDetail");
  });
});
