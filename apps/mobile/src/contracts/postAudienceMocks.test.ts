import { resolveMockApiRequest } from "@/mocks";
import type { Post } from "@/types";

describe("post audience mock contract", () => {
  it.each(["everyone", "followers"] as const)("accepts %s", async (audience) => {
    await expect(resolveMockApiRequest<Post>("POST", "/api/v1/posts", { text: "Audience mock", mediaIds: [], audience })).resolves.toMatchObject({ text: "Audience mock" });
  });

  it("rejects subscribers as an audience value instead of silently treating it as Everyone", async () => {
    await expect(resolveMockApiRequest("POST", "/api/v1/posts", { text: "Unsupported audience", mediaIds: [], audience: "subscribers" })).rejects.toMatchObject({ status: 400, code: "VALIDATION_FAILED" });
  });
});
