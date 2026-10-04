import { describe, expect, it } from "vitest";

import type { ApplySensitiveLabelsCommand } from "../../src/modules/contentEvents/commands/applySensitiveLabels/applySensitiveLabels.command.js";
import { createContentEventRouter } from "../../src/modules/contentEvents/services/contentEventRouter.service.js";

const envelope = (type: string, data: Record<string, unknown>) => JSON.stringify({ id: "e1", type, occurredAt: "2026-10-04T10:00:00.000Z", data });
const postId = "0192f0a0-0000-7000-8000-000000000001";

describe("sensitive label events", () => {
  it("takes moderation labels and only high-confidence advisory labels", async () => {
    const applied: ApplySensitiveLabelsCommand[] = [];
    const route = createContentEventRouter({ applyContentVisibility: async () => true, applyProcessedMedia: async () => undefined, applySensitiveLabels: async (command) => (applied.push(command), true) });
    await route(envelope("content.visibilityChanged", { targetType: "post", targetId: postId, visibility: "restricted", labels: ["graphic_violence", "made_up"] }));
    await route(envelope("content.sensitivityAdvised", { targetType: "clip", targetId: postId, scores: [{ label: "nudity", score: 0.95 }, { label: "self_harm", score: 0.2 }] }));
    expect(applied.map((command) => [command.source, command.labels])).toEqual([["moderation", ["graphic_violence"]], ["advisory", ["nudity"]]]);
  });
});
