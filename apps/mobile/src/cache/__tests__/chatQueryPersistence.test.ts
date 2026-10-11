import type { Query } from "@tanstack/react-query";

import { isQuerySafeToPersistOnDevice } from "../queryClient.config";

jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));
jest.mock("@react-native-community/netinfo", () => ({ addEventListener: jest.fn() }));
jest.mock("@/store/offline.store", () => ({ isDeviceConnectedAccordingToNetInfo: () => true }));

const query = (queryKey: readonly unknown[]) => ({ queryKey, state: { status: "success" } }) as unknown as Query;

describe("persisted query cache", () => {
  it("never writes decrypted chats or previews to unsealed device storage", () => {
    expect(isQuerySafeToPersistOnDevice(query(["messages", "c1"]))).toBe(false);
    expect(isQuerySafeToPersistOnDevice(query(["conversation", "c1"]))).toBe(false);
    expect(isQuerySafeToPersistOnDevice(query(["conversations", "chats"]))).toBe(false);
  });

  it("still keeps public content for offline start", () => {
    expect(isQuerySafeToPersistOnDevice(query(["feed", "for-you"]))).toBe(true);
    expect(isQuerySafeToPersistOnDevice(query(["products", "p1"]))).toBe(true);
  });
});
