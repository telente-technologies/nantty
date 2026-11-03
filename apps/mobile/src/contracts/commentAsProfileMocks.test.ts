import { resolveMockApiRequest } from "@/mocks";
import type { ActingProfile } from "@/types/brand.type";
import type { Comment, Page } from "@/types";

describe("commenting as a managed profile", () => {
  it("persists a selected owned business profile identity", async () => {
    const profiles = await resolveMockApiRequest<Page<ActingProfile>>("GET", "/api/v1/users/me/profiles");
    const profile = profiles.data.find((item) => item.kind === "brand" || item.kind === "store" || item.kind === "business");
    expect(profile).toBeDefined();
    const comment = await resolveMockApiRequest<Comment>("POST", "/api/v1/posts/post_1/comments", { text: "A note from the store", asProfileId: profile!.id });
    expect(comment).toMatchObject({ author: { id: "u_me" }, postedAs: { id: profile!.id, name: profile!.name, handle: profile!.handle } });
  });

  it("rejects an unowned profile identity", async () => {
    await expect(resolveMockApiRequest("POST", "/api/v1/posts/post_1/comments", { text: "Forged identity", asProfileId: "not-owned-profile" })).rejects.toMatchObject({ status: 404, code: "PROFILE_NOT_FOUND" });
  });
});
