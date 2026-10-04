import { resolveMockApiRequest } from "@/mocks";
import type { Page, Post, TaggedUser } from "@/types";

describe("tagged users mocks", () => {
  it("inlines a preview on the post and pages the full list", async () => {
    const post = await resolveMockApiRequest<Post>("GET", "/api/v1/posts/post_6");
    expect(post.taggedUsers?.length).toBe(3);
    const first = await resolveMockApiRequest<Page<TaggedUser>>("GET", "/api/v1/posts/post_6/tagged-users");
    expect(first.data).toHaveLength(10);
    expect(first.nextCursor).toBe("10");
    const second = await resolveMockApiRequest<Page<TaggedUser>>("GET", `/api/v1/posts/post_6/tagged-users?cursor=${first.nextCursor}`);
    expect(first.data.length + second.data.length).toBe(post.taggedUsersCount);
    expect(second.nextCursor).toBeNull();
    expect(first.data[0]).toEqual(expect.objectContaining({ id: expect.any(String), username: expect.any(String), displayName: expect.any(String) }));
  });

  it("returns an empty page for untagged posts", async () => {
    const page = await resolveMockApiRequest<Page<TaggedUser>>("GET", "/api/v1/posts/post_2/tagged-users");
    expect(page).toEqual({ data: [], nextCursor: null });
  });

  it("lets guests read the tagged list", async () => {
    await expect(resolveMockApiRequest("GET", "/api/v1/posts/post_3/tagged-users", undefined, undefined, true)).resolves.toBeDefined();
  });
});
