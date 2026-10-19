import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

import { ApiError } from "@/errors/api.error";
import type { Page } from "@/types";
import type { FollowRequest, FollowState } from "@/types/socialGraph.type";

import { followToggleFailureMessage } from "../confirmedFollowToggle.hook";
import { FollowRequestRow } from "../followRequestRow";
import { followRequestsQueryKey, useSettleFollowRequestMutation } from "../followRequests.hook";
import { followButtonLabelForState, followStatusPollIntervalMs, isFollowStateHighlighted, lockedProfileCopyByLock, resolveProfileLock } from "../followState.util";
import { LockedProfileNotice } from "../lockedProfileNotice";
import { buildOwnProfileMenuItems } from "../ownProfileMenu.util";

const mockAccept = jest.fn();
const mockReject = jest.fn();
const mockShowToast = jest.fn();

jest.mock("@/services/social/follows.service", () => ({
  followsService: { acceptFollowRequest: (id: string) => mockAccept(id), rejectFollowRequest: (id: string) => mockReject(id), listMyFollowRequests: jest.fn() },
}));
jest.mock("@/store/toast.store", () => ({ showToast: (...args: unknown[]) => mockShowToast(...args) }));

const requester = (id: string, name: string) => ({ id, name, username: name.toLowerCase(), avatarUrl: null, verified: false });
const requests: Page<FollowRequest> = { data: [{ id: "r1", requester: requester("u1", "Ada"), createdAt: "2026-10-17T10:00:00Z" }, { id: "r2", requester: requester("u2", "Grace"), createdAt: "2026-10-17T10:01:00Z" }], nextCursor: null };

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);

beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  client.setQueryData(followRequestsQueryKey, requests);
});
afterEach(() => client.clear());

describe("locked view of a private profile", () => {
  const privateProfile = (followState?: FollowState) => ({ isPrivate: true, followState });
  it.each([
    ["guest", privateProfile(undefined), "private", "Follow"],
    ["none", privateProfile("none"), "private", "Follow"],
    ["requested", privateProfile("requested"), "private", "Requested"],
    ["rejected", privateProfile("rejected"), "private", "Follow"],
    ["accepted", privateProfile("accepted"), "open", "Following"],
    ["blocked", privateProfile("blocked"), "blocked", "Unblock"],
  ] as const)("%s viewer", (_name, profile, lock, label) => {
    expect(resolveProfileLock(profile)).toBe(lock);
    expect(followButtonLabelForState(profile.followState)).toBe(label);
  });

  it("keeps a public profile open unless the viewer blocked it", () => {
    expect(resolveProfileLock({ isPrivate: false, followState: "none" })).toBe("open");
    expect(resolveProfileLock({ isPrivate: false, followState: "blocked" })).toBe("blocked");
  });

  it("only highlights the Follow call to action", () => {
    expect(isFollowStateHighlighted("none")).toBe(true);
    expect(isFollowStateHighlighted("rejected")).toBe(true);
    expect(isFollowStateHighlighted("requested")).toBe(false);
    expect(isFollowStateHighlighted("blocked")).toBe(false);
  });

  it("shows the private notice with a lock and the exact copy", async () => {
    await render(createElement(LockedProfileNotice, { copy: lockedProfileCopyByLock.private }));
    expect(screen.getByText("This account is private")).toBeTruthy();
    expect(screen.getByText("Follow to see their photos and videos.")).toBeTruthy();
  });

  it("keeps polling the follow status while a request is pending, so the profile unlocks on accept", () => {
    expect(followStatusPollIntervalMs("requested")).toBe(15_000);
    for (const state of ["none", "accepted", "rejected", "blocked", undefined] as const) expect(followStatusPollIntervalMs(state)).toBe(false);
  });

  it("explains the re-request cooldown instead of a generic failure", () => {
    expect(followToggleFailureMessage(new ApiError(429, "Too many", "FOLLOW_REQUEST_COOLDOWN"), "requested", "@ada")).toBe("You can ask to follow @ada again in a little while.");
    expect(followToggleFailureMessage(new Error("offline"), "requested", "@ada")).toBe("Couldn't follow @ada. Try again.");
  });
});

describe("follow requests screen", () => {
  it("labels each row Confirm and Delete", async () => {
    const onConfirm = jest.fn();
    const onDelete = jest.fn();
    await render(createElement(FollowRequestRow, { request: requests.data[0]!, onConfirm, onDelete, onPressUser: jest.fn() }));
    await fireEvent.press(screen.getByLabelText("Confirm Ada's follow request"));
    await fireEvent.press(screen.getByLabelText("Delete Ada's follow request"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("removes a confirmed request at once", async () => {
    let finish: () => void = () => undefined;
    mockAccept.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    const { result } = await renderHook(() => useSettleFollowRequestMutation(), { wrapper });
    await act(async () => { result.current.mutate({ requestId: "r1", approve: true, requesterName: "Ada" }); });
    await act(async () => { await Promise.resolve(); });
    expect(client.getQueryData<Page<FollowRequest>>(followRequestsQueryKey)?.data.map((request) => request.id)).toEqual(["r2"]);
    await act(async () => { finish(); await Promise.resolve(); });
    expect(mockAccept).toHaveBeenCalledWith("r1");
  });

  it("puts a deleted request back and says so when the server fails", async () => {
    mockReject.mockRejectedValue(new Error("offline"));
    const { result } = await renderHook(() => useSettleFollowRequestMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ requestId: "r2", approve: false, requesterName: "Grace" }).catch(() => undefined);
    });
    expect(client.getQueryData<Page<FollowRequest>>(followRequestsQueryKey)?.data.map((request) => request.id)).toEqual(["r1", "r2"]);
    expect(mockShowToast).toHaveBeenCalledWith("Couldn't delete Grace's request. Try again.", { tone: "error" });
  });

  it("badges the Follow requests menu entry with the pending count", () => {
    const creatorEntry = { label: "Creator", route: "CreatorProgram" as const, isLoading: false };
    const item = (pending: number, more = false) => buildOwnProfileMenuItems({ profile: { isPrivate: true }, creatorEntry: creatorEntry as never, pendingFollowRequests: pending, hasMoreFollowRequests: more }).find((entry) => entry.key === "followRequests");
    expect(item(2)?.badge).toBe("2");
    expect(item(20, true)?.badge).toBe("20+");
    expect(item(0)?.badge).toBeUndefined();
  });
});
