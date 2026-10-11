import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

import { followQueryKeys } from "@/cache/followCache.util";
import { useDialogStore } from "@/store/dialog.store";
import type { FollowStatus } from "@/types/socialGraph.type";

import { useFollowUserToggle } from "../confirmedFollowToggle.hook";

const mockFollowUser = jest.fn();
const mockUnfollowUser = jest.fn();
const mockShowToast = jest.fn();

jest.mock("@/services/social/follows.service", () => ({
  followsService: { followUser: (id: string) => mockFollowUser(id), unfollowUser: (id: string) => mockUnfollowUser(id) },
}));
jest.mock("@/store/toast.store", () => ({ showToast: (...args: unknown[]) => mockShowToast(...args) }));

const STATUS_KEY = followQueryKeys.followStatus("u_1");
const LIST_KEY = ["users", "me", "connections", "following"];
const status: FollowStatus = { state: "accepted", followedBy: false, followersCount: 10, followingCount: 2, viewerPostNotifications: "posts_and_lives" };
const ada = { id: "u_1", username: "ada" };

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
const currentDialog = () => useDialogStore.getState().queue[0];
const pressDialogAction = async (label: string) => {
  const action = currentDialog()?.actions?.find((candidate) => candidate.label === label);
  useDialogStore.getState().closeCurrentDialog();
  await act(async () => {
    action?.onPress?.();
    await Promise.resolve();
  });
};

afterEach(() => client.clear());

beforeEach(() => {
  jest.clearAllMocks();
  useDialogStore.setState({ queue: [] });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(STATUS_KEY, status);
  client.setQueryData(LIST_KEY, [{ id: "u_1", username: "ada", followState: "accepted", isFollowing: true }]);
});

describe("useFollowUserToggle", () => {
  it("follows without asking", async () => {
    mockFollowUser.mockResolvedValue({ state: "accepted" });
    const { result } = await renderHook(() => useFollowUserToggle(), { wrapper });
    await act(async () => {
      result.current.toggleUser({ ...ada, followState: "none" });
    });
    expect(currentDialog()).toBeUndefined();
    expect(mockFollowUser).toHaveBeenCalledWith("u_1");
  });

  it("asks before unfollowing, then unfollows optimistically and turns the bell off", async () => {
    let resolve: () => void = () => undefined;
    mockUnfollowUser.mockReturnValue(new Promise<void>((done) => { resolve = done; }));
    const { result } = await renderHook(() => useFollowUserToggle(), { wrapper });
    await act(async () => {
      result.current.toggleUser({ ...ada, followState: "accepted" });
    });
    expect(currentDialog()).toMatchObject({ title: "Unfollow @ada?", message: "Their posts will no longer show up in your Following feed." });
    expect(mockUnfollowUser).not.toHaveBeenCalled();
    await pressDialogAction("Unfollow");
    expect(client.getQueryData<FollowStatus>(STATUS_KEY)).toMatchObject({ state: "none", viewerPostNotifications: "off" });
    expect(client.getQueryData<{ followState: string }[]>(LIST_KEY)?.[0]?.followState).toBe("none");
    await act(async () => {
      result.current.toggleUser({ ...ada, followState: "none" });
    });
    expect(mockFollowUser).not.toHaveBeenCalled();
    await act(async () => {
      resolve();
    });
    expect(mockUnfollowUser).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the confirm is cancelled and ignores a double tap while it is open", async () => {
    const { result } = await renderHook(() => useFollowUserToggle(), { wrapper });
    await act(async () => {
      result.current.toggleUser({ ...ada, followState: "accepted" });
      result.current.toggleUser({ ...ada, followState: "accepted" });
    });
    expect(useDialogStore.getState().queue).toHaveLength(1);
    await pressDialogAction("Cancel");
    expect(mockUnfollowUser).not.toHaveBeenCalled();
    expect(client.getQueryData<FollowStatus>(STATUS_KEY)?.state).toBe("accepted");
    await act(async () => {
      result.current.toggleUser({ ...ada, followState: "accepted" });
    });
    expect(useDialogStore.getState().queue).toHaveLength(1);
  });

  it("rolls back and shows a toast when unfollowing fails", async () => {
    mockUnfollowUser.mockRejectedValue(new Error("offline"));
    const { result } = await renderHook(() => useFollowUserToggle(), { wrapper });
    await act(async () => {
      result.current.toggleUser({ ...ada, followState: "accepted" });
    });
    await pressDialogAction("Unfollow");
    await act(async () => {
      await Promise.resolve();
    });
    expect(client.getQueryData<FollowStatus>(STATUS_KEY)?.state).toBe("accepted");
    expect(client.getQueryData<{ followState: string }[]>(LIST_KEY)?.[0]?.followState).toBe("accepted");
    expect(mockShowToast).toHaveBeenCalledWith("Couldn't unfollow @ada. Try again.", { tone: "error" });
  });

  it("asks before cancelling a pending follow request", async () => {
    mockUnfollowUser.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useFollowUserToggle(), { wrapper });
    await act(async () => {
      result.current.toggleUser({ ...ada, followState: "requested" });
    });
    expect(currentDialog()?.title).toBe("Cancel follow request?");
    await pressDialogAction("Cancel request");
    expect(mockUnfollowUser).toHaveBeenCalledWith("u_1");
  });
});
