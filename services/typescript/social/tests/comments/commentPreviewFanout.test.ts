import { describe, expect, it } from "vitest";

import { commentRepository } from "../../src/modules/comments/repositories/comment.repository.js";
import type { Db } from "../../src/types/database.type.js";

describe("comment preview fan-out", () => {
  it("caps the number of parents and bounds concurrent queries", async () => {
    const parentIds = Array.from({ length: 80 }, (_, index) => `comment-${index}`);
    let inFlight = 0;
    let peak = 0;
    let calls = 0;
    const db = {
      comment: {
        findMany: async (args: { take: number }) => {
          calls += 1;
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await new Promise((resolve) => setTimeout(resolve, 2));
          inFlight -= 1;
          expect(args.take).toBe(3);
          return [];
        },
      },
    } as unknown as Db;

    const previews = await commentRepository.previewRepliesFor(db, parentIds, 3);

    expect(calls).toBe(50);
    expect(previews.size).toBe(50);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(8);
  });
});
