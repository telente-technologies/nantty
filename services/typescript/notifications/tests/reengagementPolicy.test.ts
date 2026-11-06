import { describe, expect, it } from "vitest";

import { buildReengagementPush, isInLocalQuietHours, isValidIanaTimeZone, reengagementContentKeyAt } from "../src/modules/reengagement/services/reengagementPolicy.service.js";

describe("re-engagement policy", () => {
  it("accepts valid IANA zones and rejects invalid, empty, and malformed values", () => {
    expect(isValidIanaTimeZone("Africa/Lagos")).toBe(true);
    expect(isValidIanaTimeZone("UTC")).toBe(true);
    expect(isValidIanaTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidIanaTimeZone(" Africa/Lagos ")).toBe(false);
    expect(isValidIanaTimeZone("")).toBe(false);
  });

  it("honors configured local quiet hours across timezones and midnight", () => {
    const hours = { start: "21:00", end: "08:00" };
    expect(isInLocalQuietHours("Africa/Lagos", new Date("2026-11-06T21:00:00Z"), hours)).toBe(true);
    expect(isInLocalQuietHours("Africa/Lagos", new Date("2026-11-07T06:59:00Z"), hours)).toBe(true);
    expect(isInLocalQuietHours("Africa/Lagos", new Date("2026-11-07T08:00:00Z"), hours)).toBe(false);
    expect(isInLocalQuietHours("America/Los_Angeles", new Date("2026-11-07T05:00:00Z"), hours)).toBe(true);
  });

  it("uses a generic return-to-app message without inventing recommended content", () => {
    expect(buildReengagementPush()).toEqual({
      title: "Come back to Nantty",
      body: "There’s more to explore on Nantty whenever you’re ready.",
      data: { screen: "Home", source: "reengagement" },
    });
  });

  it("deduplicates a campaign within a seven-day window but permits a later eligible window", () => {
    const first = new Date(0);
    expect(reengagementContentKeyAt(first)).toBe(reengagementContentKeyAt(new Date(first.getTime() + 6 * 24 * 60 * 60_000)));
    expect(reengagementContentKeyAt(first)).not.toBe(reengagementContentKeyAt(new Date(first.getTime() + 7 * 24 * 60 * 60_000)));
  });
});
