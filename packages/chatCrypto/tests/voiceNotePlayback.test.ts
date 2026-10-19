import { describe, expect, it, vi } from "vitest";

import {
  createExclusivePlaybackCoordinator, easeOutQuart, formatVoiceNoteClock, formatVoiceNotePlaybackRate, interpolatePlayPausePolygons, nextVoiceNotePlaybackRate, pauseIconPolygons,
  playIconPolygons, playedBarCount, polygonPathData, seekFractionFromPosition,
} from "../src";

describe("play and pause morph", () => {
  it("starts at the play triangle and ends at the pause bars", () => {
    expect(interpolatePlayPausePolygons(0)).toEqual(playIconPolygons);
    expect(interpolatePlayPausePolygons(1)).toEqual(pauseIconPolygons);
    expect(interpolatePlayPausePolygons(-1)).toEqual(playIconPolygons);
    expect(interpolatePlayPausePolygons(7)).toEqual(pauseIconPolygons);
    expect(interpolatePlayPausePolygons(Number.NaN)).toEqual(playIconPolygons);
    expect(interpolatePlayPausePolygons(0.5)[0]).toEqual([7, 4.5, 11.75, 6.3, 11.75, 17.7, 7, 19.5]);
  });

  it("renders SVG path data for each polygon", () => {
    expect(polygonPathData(playIconPolygons[0])).toBe("M7 4L13 7.6L13 16.4L7 20Z");
    expect(polygonPathData(pauseIconPolygons[1])).toBe("M13.5 5L17 5L17 19L13.5 19Z");
    expect(polygonPathData([])).toBe("");
  });

  it("eases out with a quartic curve", () => {
    expect(easeOutQuart(0)).toBe(0);
    expect(easeOutQuart(1)).toBe(1);
    expect(easeOutQuart(0.5)).toBeCloseTo(0.9375);
    expect(easeOutQuart(2)).toBe(1);
  });
});

describe("formatting", () => {
  it("formats m:ss", () => {
    expect(formatVoiceNoteClock(0)).toBe("0:00");
    expect(formatVoiceNoteClock(12.9)).toBe("0:12");
    expect(formatVoiceNoteClock(65)).toBe("1:05");
    expect(formatVoiceNoteClock(300)).toBe("5:00");
    expect(formatVoiceNoteClock(-3)).toBe("0:00");
    expect(formatVoiceNoteClock(Number.NaN)).toBe("0:00");
  });

  it("cycles playback speed 1×, 1.5×, 2×", () => {
    expect(nextVoiceNotePlaybackRate(1)).toBe(1.5);
    expect(nextVoiceNotePlaybackRate(1.5)).toBe(2);
    expect(nextVoiceNotePlaybackRate(2)).toBe(1);
    expect(nextVoiceNotePlaybackRate(3)).toBe(1);
    expect(formatVoiceNotePlaybackRate(1.5)).toBe("1.5×");
  });
});

describe("scrubbing", () => {
  it("maps a pointer position to a seek fraction and played bar count", () => {
    expect(seekFractionFromPosition(50, 200)).toBe(0.25);
    expect(seekFractionFromPosition(-10, 200)).toBe(0);
    expect(seekFractionFromPosition(500, 200)).toBe(1);
    expect(seekFractionFromPosition(10, 0)).toBe(0);
    expect(playedBarCount(0.5, 28)).toBe(14);
    expect(playedBarCount(1.4, 28)).toBe(28);
    expect(playedBarCount(Number.NaN, 28)).toBe(0);
  });
});

describe("one voice note at a time", () => {
  it("pauses the first voice note when a second starts", () => {
    const coordinator = createExclusivePlaybackCoordinator();
    const pauseFirst = vi.fn();
    const pauseSecond = vi.fn();
    coordinator.claim("first", pauseFirst);
    coordinator.claim("first", pauseFirst);
    expect(pauseFirst).not.toHaveBeenCalled();
    coordinator.claim("second", pauseSecond);
    expect(pauseFirst).toHaveBeenCalledTimes(1);
    coordinator.release("first");
    coordinator.release("second");
    coordinator.claim("first", pauseFirst);
    expect(pauseSecond).not.toHaveBeenCalled();
  });

  it("keeps a newer claim when a stale player with the same id unregisters, and survives a pause that throws", () => {
    const coordinator = createExclusivePlaybackCoordinator();
    const pauseUnmountedPlayer = vi.fn(() => {
      throw new Error("Unable to find the native shared object");
    });
    const pauseRemountedPlayer = vi.fn();
    const pauseOther = vi.fn();
    coordinator.claim("composer-preview", pauseUnmountedPlayer);
    coordinator.claim("composer-preview", pauseRemountedPlayer);
    coordinator.release("composer-preview", pauseUnmountedPlayer);
    coordinator.claim("bubble", pauseOther);
    expect(pauseRemountedPlayer).toHaveBeenCalledTimes(1);
    coordinator.claim("crashing", pauseUnmountedPlayer);
    expect(() => coordinator.claim("next", pauseOther)).not.toThrow();
  });
});
