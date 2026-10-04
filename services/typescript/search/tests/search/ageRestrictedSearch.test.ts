import { describe, expect, it } from "vitest";

import { createSearchHarness, envelope } from "../fakes/searchHarness.fake.js";
import { postSource } from "../fakes/sourceFixtures.fake.js";
import { buildPostDocument } from "../../src/modules/indexing/services/contentDocumentBuilders.service.js";

const base = { cursor: undefined, limit: 20, region: undefined, scope: "posts" } as const;

describe("age-restricted search results", () => {
  it("marks nudity and dangerous-act posts as restricted for minors when indexing", () => {
    expect(buildPostDocument(postSource({ sensitiveLabels: ["nudity"] }), 1)?.restrictedForMinors).toBe(true);
    expect(buildPostDocument(postSource({ sensitiveLabels: ["graphic_violence"] }), 1)?.restrictedForMinors).toBe(false);
  });

  it("never returns restricted posts to guests, minors or unknown ages", async () => {
    const harness = createSearchHarness();
    harness.hydrator.posts.set("post_safe", postSource({ postId: "post_safe", caption: "Ankara fit #ankara" }));
    harness.hydrator.posts.set("post_adult", postSource({ postId: "post_adult", caption: "Ankara night #ankara", sensitiveLabels: ["nudity"] }));
    for (const postId of ["post_safe", "post_adult"]) await harness.processor.process(envelope("post.created", { postId }));
    const ids = async (viewerId: string | undefined, viewerIsAdult: boolean) => (await harness.service.search({ ...base, viewerId, viewerIsAdult, query: "ankara" })).data.map((item) => item["id"]).sort();
    expect(await ids(undefined, false)).toEqual(["post_safe"]);
    expect(await ids("0192f0a0-0000-7000-8000-00000000c001", false)).toEqual(["post_safe"]);
    expect(await ids("0192f0a0-0000-7000-8000-00000000c001", true)).toEqual(["post_adult", "post_safe"]);
  });
});
