import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

import { followQueryKeys } from "@/cache/followCache.util";
import type { FollowStatus } from "@/types/socialGraph.type";

import { useSetPostNotificationsMutation } from "../profileQueries.hook";

const mockSetPostNotifications = jest.fn();
const mockShowToast = jest.fn();

jest.mock("@/services/social/follows.service", () => ({ followsService: { setPostNotifications: (...args: unknown[]) => mockSetPostNotifications(...args) } }));
jest.mock("@/services/account/users.service", () => ({ usersService: {} }));
jest.mock("@/store/toast.store", () => ({ showToast: (...args: unknown[]) => mockShowToast(...args) }));

const STATUS_KEY = followQueryKeys.followStatus("u_1");
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
const level = () => client.getQueryData<FollowStatus>(STATUS_KEY)?.viewerPostNotifications;

beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  client.setQueryData<FollowStatus>(STATUS_KEY, { state: "accepted", followedBy: false, followersCount: 1, followingCount: 1, viewerPostNotifications: "off" });
});
afterEach(() => client.clear());

describe("useSetPostNotificationsMutation", () => {
  it("updates the bell immediately and keeps the server's answer", async () => {
    mockSetPostNotifications.mockResolvedValue({ level: "posts_and_lives", following: true });
    const { result } = await renderHook(() => useSetPostNotificationsMutation("u_1"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("posts_and_lives");
    });
    expect(mockSetPostNotifications).toHaveBeenCalledWith("u_1", "posts_and_lives");
    expect(level()).toBe("posts_and_lives");
  });

  it("rolls back and tells the viewer when the server refuses, e.g. 409 NOT_FOLLOWING", async () => {
    mockSetPostNotifications.mockRejectedValue(Object.assign(new Error("Follow this account to get post notifications."), { status: 409, code: "NOT_FOLLOWING" }));
    const { result } = await renderHook(() => useSetPostNotificationsMutation("u_1"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("posts").catch(() => undefined);
    });
    expect(level()).toBe("off");
    expect(mockShowToast).toHaveBeenCalledWith("Couldn't update post notifications. Try again.", { tone: "error" });
  });
});
