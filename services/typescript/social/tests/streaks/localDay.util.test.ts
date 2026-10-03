import { describe, expect, it } from "vitest";

import { addDaysToLabel, daysBetweenLabels, endOfLocalDay, localDayLabel, secondsUntilLocalDayEnds, startOfLocalDay } from "../../src/utils/localDay.util.js";

describe("local days", () => {
  it("labels the same instant differently per zone", () => {
    const instant = new Date("2026-10-03T23:30:00Z");
    expect(localDayLabel(instant, "UTC")).toBe("2026-10-03");
    expect(localDayLabel(instant, "Africa/Lagos")).toBe("2026-10-04");
    expect(localDayLabel(instant, "America/Los_Angeles")).toBe("2026-10-03");
  });
  it("finds the end of a local day", () => {
    expect(endOfLocalDay("2026-10-03", "Africa/Lagos").toISOString()).toBe("2026-10-03T23:00:00.000Z");
    expect(secondsUntilLocalDayEnds(new Date("2026-10-03T21:00:00Z"), "Africa/Lagos")).toBe(7200);
  });
  it("handles daylight saving days of 23 and 25 hours", () => {
    const spring = endOfLocalDay("2026-03-08", "America/New_York").getTime() - startOfLocalDay("2026-03-08", "America/New_York").getTime();
    const autumn = endOfLocalDay("2026-11-01", "America/New_York").getTime() - startOfLocalDay("2026-11-01", "America/New_York").getTime();
    expect(spring / 3_600_000).toBe(23);
    expect(autumn / 3_600_000).toBe(25);
  });
  it("does label arithmetic", () => {
    expect(addDaysToLabel("2026-02-28", 1)).toBe("2026-03-01");
    expect(daysBetweenLabels("2026-12-31", "2027-01-02")).toBe(2);
  });
});
