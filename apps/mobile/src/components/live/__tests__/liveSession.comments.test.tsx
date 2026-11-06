import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

import { liveService } from "@/services/live/live.service";

import { useLiveSessionWithActions } from "../liveSession.hook";

jest.mock("@/utils/requireAuth.util", () => ({ requireAuthThen: (action: () => void) => action() }));

describe("useLiveSessionWithActions live comment history", () => {
  afterEach(() => jest.restoreAllMocks());

  it("loads older cursor pages on demand and merges them with latest polling rows", async () => {
    const fetchPage = jest.spyOn(liveService, "fetchLiveComments")
      .mockResolvedValueOnce({ data: [comment("c30")], nextCursor: "cursor-30" })
      .mockResolvedValueOnce({ data: [comment("c29")], nextCursor: "cursor-29" })
      .mockResolvedValueOnce({ data: [comment("c28")], nextCursor: null })
      .mockResolvedValueOnce({ data: [comment("c31"), comment("c30")], nextCursor: "cursor-30" });
    jest.spyOn(liveService, "fetchLiveSessionById").mockResolvedValue({} as never);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
    const { result, unmount } = await renderHook(() => useLiveSessionWithActions("live-1", true), { wrapper });

    await waitFor(() => expect(result.current.comments.canLoadOlder).toBe(true));
    await act(async () => { result.current.comments.loadOlder(); await Promise.resolve(); });
    await waitFor(() => expect(fetchPage).toHaveBeenNthCalledWith(2, "live-1", "cursor-30"));
    await waitFor(() => expect(result.current.comments.data.data.map((item) => item.id)).toEqual(["c30", "c29"]));

    await act(async () => { result.current.comments.loadOlder(); await Promise.resolve(); });
    await waitFor(() => expect(fetchPage).toHaveBeenNthCalledWith(3, "live-1", "cursor-29"));
    await waitFor(() => expect(result.current.comments.data.data.map((item) => item.id)).toEqual(["c30", "c29", "c28"]));

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["live-comments", "live-1"], exact: true });
    });
    expect(fetchPage).toHaveBeenCalledTimes(4);
    expect(fetchPage.mock.calls[3]).toEqual(["live-1"]);
    await waitFor(() => expect(result.current.comments.data.data.map((item) => item.id)).toEqual(["c31", "c30", "c29", "c28"]));

    unmount();
    queryClient.clear();
  });
});

function comment(id: string) {
  return {
    id,
    author: { id: "viewer-1", name: "Viewer", username: "viewer", avatarUrl: null, verified: false },
    text: id,
    kind: "comment" as const,
  };
}
