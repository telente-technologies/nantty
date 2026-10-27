import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

import type { Post } from "@/types";

import { useQuotedPostPreview } from "../quotedPostPreview.hook";

const mockMissing = new Set<string>();
const mockPost = (id: string) => ({ id, kind: "post", author: { id: "a1", name: "Ada", username: "ada", avatarUrl: null, verified: false }, text: `post ${id}`, media: [], createdAt: "2026-10-10T00:00:00Z" }) as unknown as Post;

jest.mock("@/services/content/posts.service", () => ({
  postsService: {
    fetchPostById: async (id: string) => {
      if (mockMissing.has(id)) throw new (jest.requireActual("@/errors/api.error").ApiError)(404, "gone", "POST_NOT_FOUND");
      return mockPost(id);
    },
  },
}));

const link = (id: string) => `https://app.nantty.com/post/${id}`;

function renderPreview(initialText: string, quotePostId?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  return renderHook(({ text }: { text: string }) => useQuotedPostPreview(text, quotePostId), { wrapper, initialProps: { text: initialText } });
}

describe("useQuotedPostPreview", () => {
  beforeEach(() => mockMissing.clear());

  it("attaches the quoted post from the Quote button and sends it explicitly", async () => {
    const { result } = await renderPreview("", "p1");
    await waitFor(() => expect(result.current.preview?.status).toBe("ready"));
    expect(result.current.quotedPostId).toBe("p1");
    expect(result.current.attachedPostId).toBe("p1");
  });

  it("turns into a normal post when the card is removed, and re-attaches when the link is pasted again", async () => {
    const { result, rerender } = await renderPreview("", "p1");
    await act(async () => result.current.remove());
    expect(result.current.preview).toBeNull();
    expect(result.current.quotedPostId).toBeUndefined();
    await rerender({ text: `nice ${link("p1")}` });
    await waitFor(() => expect(result.current.preview?.status).toBe("ready"));
    expect(result.current.quotedPostId).toBe("p1");
  });

  it("keeps a removed link as text until the link changes", async () => {
    const { result, rerender } = await renderPreview(`wow ${link("p2")}`);
    await waitFor(() => expect(result.current.quotedPostId).toBe("p2"));
    await act(async () => result.current.remove());
    expect(result.current.quotedPostId).toBeNull();
    await rerender({ text: "wow" });
    await rerender({ text: `wow ${link("p2")}` });
    await waitFor(() => expect(result.current.quotedPostId).toBe("p2"));
  });

  it("flags a quote of a post that is gone so publishing can be blocked", async () => {
    mockMissing.add("p3");
    const { result } = await renderPreview("", "p3");
    await waitFor(() => expect(result.current.isUnavailable).toBe(true));
    await act(async () => result.current.remove());
    expect(result.current.isUnavailable).toBe(false);
  });

  it("restores a saved draft's quote", async () => {
    const { result } = await renderPreview("draft text");
    await act(async () => result.current.attach("p4"));
    await waitFor(() => expect(result.current.preview?.status).toBe("ready"));
    expect(result.current.quotedPostId).toBe("p4");
  });
});
