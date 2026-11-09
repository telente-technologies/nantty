import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";

const mockFetchPostAnalytics = jest.fn();
const mockFetchStoryViewers = jest.fn();

jest.mock("@/services/content/posts.service", () => ({ postsService: { fetchPostAnalytics: (...args: unknown[]) => mockFetchPostAnalytics(...args) } }));
jest.mock("@/services/clips/stories.service", () => ({ storiesService: { fetchStoryViewers: (...args: unknown[]) => mockFetchStoryViewers(...args) } }));
jest.mock("@/store/auth.store", () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { isCreator: false } }) }));
jest.mock("@/theme", () => ({ useTheme: () => ({ colors: { primary: "brand", textMuted: "muted", surface: "surface" } }), makeThemedStyles: (create: (colors: unknown) => unknown) => () => create({ primary: "brand", textMuted: "muted", surface: "surface" }) }));
jest.mock("@/components/icons", () => ({ Analytics24Icon: () => null }));
jest.mock("@/components/ui/avatar", () => ({ Avatar: () => null }));
jest.mock("@/components/ui/brandLoader", () => ({ BrandLoader: () => null }));
jest.mock("@/components/ui/errorState", () => ({ ErrorState: () => null }));
jest.mock("@/components/ui/header", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const { Text } = jest.requireActual("react-native") as typeof import("react-native");
  return { Header: ({ title }: { title: string }) => React.createElement(Text, null, title) };
});
jest.mock("@/components/ui/listSkeleton", () => ({ ListSkeleton: () => null }));
jest.mock("@/components/ui/screen", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const { View } = jest.requireActual("react-native") as typeof import("react-native");
  return { Screen: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children) };
});

import { StoryAnalyticsScreen, uniqueStoryViewerRows } from "./storyAnalytics.screen";

describe("StoryAnalyticsScreen", () => {
  afterEach(() => {
    cleanup();
    mockFetchPostAnalytics.mockReset();
    mockFetchStoryViewers.mockReset();
  });

  it("shows the canonical unique-viewer metric without duplicating it as impressions", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    mockFetchPostAnalytics.mockResolvedValue({
      impressions: 27,
      uniqueViewers: 99,
      likes: 6,
      comments: 4,
      shares: 3,
      profileVisits: 2,
      newFollows: 1,
      postedAt: "2026-11-07T10:00:00.000Z",
    });
    mockFetchStoryViewers.mockResolvedValue({ viewers: [], total: 8, nextCursor: null });

    const view = await render(
      <QueryClientProvider client={queryClient}>
        <StoryAnalyticsScreen
          navigation={{} as never}
          route={{ key: "StoryAnalytics", name: "StoryAnalytics", params: { storyId: "story-1" } } as never}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(view.getByText("Likes")).toBeTruthy());
    expect(view.getByText("Comments")).toBeTruthy();
    expect(view.queryByText("Impressions")).toBeNull();
    expect(view.getAllByText("Unique viewers")).toHaveLength(1);
    expect(view.getByText("8")).toBeTruthy();
    expect(view.queryByText("99")).toBeNull();
    await queryClient.cancelQueries();
    queryClient.clear();
  });

  it("shows a retryable unavailable state instead of claiming the story has no views", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    mockFetchPostAnalytics.mockResolvedValue({
      impressions: 4,
      uniqueViewers: 4,
      likes: 1,
      comments: 0,
      shares: 0,
      profileVisits: 0,
      newFollows: 0,
      postedAt: "2026-11-07T10:00:00.000Z",
    });
    mockFetchStoryViewers.mockRejectedValueOnce(new Error("Viewer service unavailable"));
    mockFetchStoryViewers.mockResolvedValueOnce({ viewers: [{ id: "viewer-1", name: "Sam", username: "sam", avatarUrl: null }], total: 1, nextCursor: null });

    const view = await render(
      <QueryClientProvider client={queryClient}>
        <StoryAnalyticsScreen
          navigation={{} as never}
          route={{ key: "StoryAnalytics", name: "StoryAnalytics", params: { storyId: "story-1" } } as never}
        />
      </QueryClientProvider>,
    );

    const retry = await view.findByText("Retry loading viewers");
    expect(view.getByText("Viewers unavailable")).toBeTruthy();
    expect(view.queryByText("No views yet. Share your story to get it seen.")).toBeNull();

    fireEvent.press(retry);
    await waitFor(() => expect(view.getByText("Sam")).toBeTruthy());
    expect(view.getByText("Viewed by 1")).toBeTruthy();
    await queryClient.cancelQueries();
    queryClient.clear();
  });

  it("keeps successfully loaded viewers visible when aggregate analytics fails", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    mockFetchPostAnalytics.mockRejectedValueOnce(new Error("Analytics service unavailable"));
    mockFetchStoryViewers.mockResolvedValueOnce({
      viewers: [{ id: "viewer-1", name: "Sam", username: "sam", avatarUrl: null, verified: false }],
      total: 1,
      nextCursor: null,
    });

    const view = await render(
      <QueryClientProvider client={queryClient}>
        <StoryAnalyticsScreen
          navigation={{} as never}
          route={{ key: "StoryAnalytics", name: "StoryAnalytics", params: { storyId: "story-1" } } as never}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(view.getByTestId("storyAnalyticsLoadError")).toBeTruthy());
    expect(view.getByText("Sam")).toBeTruthy();
    expect(view.getByText("Viewed by 1")).toBeTruthy();
    await queryClient.cancelQueries();
    queryClient.clear();
  });

  it("deduplicates viewer identities when offset pages overlap", () => {
    const sam = { id: "viewer-1", name: "Sam", username: "sam", avatarUrl: null, verified: false };
    const ali = { id: "viewer-2", name: "Ali", username: "ali", avatarUrl: null, verified: false };

    expect(uniqueStoryViewerRows([{ viewers: [sam, ali] }, { viewers: [sam] }])).toEqual([sam, ali]);
  });
});
