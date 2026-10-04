import { describe, expect, it } from "vitest";

import { classifyReportPriority } from "../../src/modules/reports/commands/submitReport/submitReport.handler.js";
import { submitReportBodySchema } from "../../src/modules/reports/validators/reports.validator.js";

describe("live reports", () => {
  it("treats child safety, self-harm and violence on a live as urgent", () => {
    expect(classifyReportPriority("child_safety")).toBe("urgent");
    expect(classifyReportPriority("self_harm", "live")).toBe("urgent");
    expect(classifyReportPriority("violence", "live")).toBe("urgent");
    expect(classifyReportPriority("self_harm", "post")).toBe("normal");
    expect(classifyReportPriority("scam", "live")).toBe("normal");
  });

  it("accepts a live report with the moment and frame it was sent from", () => {
    const parsed = submitReportBodySchema.safeParse({
      targetType: "live", targetId: "0192f3a0-0000-7000-8000-000000000001", reason: "intellectual_property",
      liveContext: { offsetSeconds: 754, frameRef: "live-safety/frames/l1/frame_20261004120000.jpeg", capturedAt: "2026-10-04T12:00:00Z" },
    });
    expect(parsed.success).toBe(true);
  });
});
