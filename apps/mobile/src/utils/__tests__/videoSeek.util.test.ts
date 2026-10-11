import {
  DOUBLE_TAP_WINDOW_MS,
  SEEK_STREAK_WINDOW_MS,
  clampSeekSeconds,
  createTapGestureState,
  doubleTapZoneAt,
  formatPlaybackTime,
  fractionFromTouch,
  isScrubbableDuration,
  resolveTap,
  scrubFraction,
  secondsAtFraction,
  type DoubleTapZone,
  type TapOutcome,
} from "../videoSeek.util";

function tapSequence(taps: readonly [DoubleTapZone, number][]): TapOutcome[] {
  let state = createTapGestureState();
  return taps.map(([zone, at]) => {
    const result = resolveTap(state, zone, at);
    state = result.state;
    return result.outcome;
  });
}

describe("seek position from touch", () => {
  it("maps x across the track and clamps outside it", () => {
    expect(fractionFromTouch(0, 300)).toBe(0);
    expect(fractionFromTouch(150, 300)).toBe(0.5);
    expect(fractionFromTouch(-40, 300)).toBe(0);
    expect(fractionFromTouch(420, 300)).toBe(1);
    expect(fractionFromTouch(100, 0)).toBe(0);
    expect(fractionFromTouch(Number.NaN, 300)).toBe(0);
  });

  it("follows the finger relative to where it grabbed", () => {
    expect(scrubFraction(0.5, 100, 160, 300)).toBeCloseTo(0.7);
    expect(scrubFraction(0.9, 100, 400, 300)).toBe(1);
    expect(scrubFraction(0.1, 100, -200, 300)).toBe(0);
    expect(scrubFraction(0.4, 100, 160, 0)).toBe(0.4);
  });

  it("never seeks past the end or before the start", () => {
    expect(clampSeekSeconds(75, 60)).toBe(59.75);
    expect(clampSeekSeconds(-12, 60)).toBe(0);
    expect(clampSeekSeconds(Number.POSITIVE_INFINITY, 60)).toBe(0);
    expect(clampSeekSeconds(8, 0)).toBe(8);
    expect(secondsAtFraction(1, 30)).toBe(29.75);
    expect(secondsAtFraction(0.5, 30)).toBe(15);
  });
});

describe("double-tap zones", () => {
  it("splits the clip into rewind, like and forward thirds", () => {
    expect(doubleTapZoneAt(40, 390, true)).toBe("rewind");
    expect(doubleTapZoneAt(195, 390, true)).toBe("like");
    expect(doubleTapZoneAt(350, 390, true)).toBe("forward");
  });

  it("likes everywhere when seeking is not allowed", () => {
    expect(doubleTapZoneAt(10, 390, false)).toBe("like");
    expect(doubleTapZoneAt(380, 390, false)).toBe("like");
    expect(doubleTapZoneAt(10, 0, true)).toBe("like");
  });
});

describe("tap gestures", () => {
  it("keeps double-tap in the middle as like", () => {
    expect(tapSequence([["like", 1000], ["like", 1200]]).map((o) => o.kind)).toEqual(["pending", "like"]);
  });

  it("treats slow taps as separate single taps", () => {
    expect(tapSequence([["forward", 1000], ["forward", 1000 + DOUBLE_TAP_WINDOW_MS + 1]]).map((o) => o.kind)).toEqual(["pending", "pending"]);
  });

  it("accumulates a rapid double-double-tap on the right into 20s ahead", () => {
    const outcomes = tapSequence([["forward", 0], ["forward", 150], ["forward", 300], ["forward", 450]]);
    expect(outcomes.map((o) => o.kind)).toEqual(["pending", "seek", "seek", "seek"]);
    expect(outcomes.filter((o) => o.kind === "seek").map((o) => (o.kind === "seek" ? o.streakSeconds : 0))).toEqual([10, 20, 30]);
  });

  it("rewinds by 10s per tap on the left and ends the streak after a pause", () => {
    const outcomes = tapSequence([["rewind", 0], ["rewind", 100], ["rewind", 100 + SEEK_STREAK_WINDOW_MS + 1]]);
    expect(outcomes[1]).toEqual({ kind: "seek", zone: "rewind", deltaSeconds: -10, streakSeconds: 10 });
    expect(outcomes[2].kind).toBe("pending");
  });

  it("likes twice on a double-double-tap in the middle without pausing", () => {
    expect(tapSequence([["like", 0], ["like", 100], ["like", 200], ["like", 300]]).map((o) => o.kind)).toEqual(["pending", "like", "pending", "like"]);
  });
});

describe("short clips and time labels", () => {
  it("does not offer scrubbing on a 3 second clip", () => {
    expect(isScrubbableDuration(3)).toBe(false);
    expect(isScrubbableDuration(5)).toBe(true);
    expect(isScrubbableDuration(Number.NaN)).toBe(false);
  });

  it("formats minutes and hours", () => {
    expect(formatPlaybackTime(0)).toBe("0:00");
    expect(formatPlaybackTime(65.9)).toBe("1:05");
    expect(formatPlaybackTime(3725)).toBe("1:02:05");
    expect(formatPlaybackTime(Number.NaN)).toBe("0:00");
  });
});
