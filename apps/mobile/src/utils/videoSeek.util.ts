export const SEEK_STEP_SECONDS = 10;
export const MINIMUM_SCRUBBABLE_SECONDS = 5;
export const VIDEO_SEEK_BAR_TOUCH_HEIGHT = 24;
export const DOUBLE_TAP_WINDOW_MS = 280;
export const SEEK_STREAK_WINDOW_MS = 700;
const END_GUARD_SECONDS = 0.25;

export type DoubleTapZone = "rewind" | "like" | "forward";

export const clampFraction = (fraction: number) => (Number.isFinite(fraction) ? Math.min(Math.max(fraction, 0), 1) : 0);

export const fractionFromTouch = (x: number, trackWidth: number) => (trackWidth > 0 ? clampFraction(x / trackWidth) : 0);

export const scrubFraction = (startFraction: number, startPageX: number, pageX: number, trackWidth: number) =>
  trackWidth > 0 ? clampFraction(startFraction + (pageX - startPageX) / trackWidth) : clampFraction(startFraction);

export function clampSeekSeconds(targetSeconds: number, durationSeconds: number): number {
  if (!Number.isFinite(targetSeconds)) return 0;
  if (!(durationSeconds > 0)) return Math.max(targetSeconds, 0);
  return Math.min(Math.max(targetSeconds, 0), Math.max(durationSeconds - END_GUARD_SECONDS, 0));
}

export const secondsAtFraction = (fraction: number, durationSeconds: number) => clampSeekSeconds(clampFraction(fraction) * Math.max(durationSeconds, 0), durationSeconds);

export const isScrubbableDuration = (durationSeconds: number) => Number.isFinite(durationSeconds) && durationSeconds >= MINIMUM_SCRUBBABLE_SECONDS;

export function doubleTapZoneAt(x: number, width: number, canSeek: boolean): DoubleTapZone {
  if (!canSeek || !(width > 0)) return "like";
  const fraction = x / width;
  if (fraction < 1 / 3) return "rewind";
  if (fraction > 2 / 3) return "forward";
  return "like";
}

export function formatPlaybackTime(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = String(safe % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

export interface TapGestureState {
  readonly lastTapAt: number;
  readonly streakZone: "rewind" | "forward" | null;
  readonly streakUntil: number;
  readonly streakSeconds: number;
}

export type TapOutcome =
  | { readonly kind: "pending" }
  | { readonly kind: "like" }
  | { readonly kind: "seek"; readonly zone: "rewind" | "forward"; readonly deltaSeconds: number; readonly streakSeconds: number };

export const createTapGestureState = (): TapGestureState => ({ lastTapAt: Number.NEGATIVE_INFINITY, streakZone: null, streakUntil: 0, streakSeconds: 0 });

export function resolveTap(state: TapGestureState, zone: DoubleTapZone, now: number): { state: TapGestureState; outcome: TapOutcome } {
  const continuesStreak = state.streakZone !== null && zone === state.streakZone && now <= state.streakUntil;
  const isDoubleTap = now - state.lastTapAt < DOUBLE_TAP_WINDOW_MS;
  if ((continuesStreak || isDoubleTap) && zone !== "like") {
    const streakSeconds = (continuesStreak ? state.streakSeconds : 0) + SEEK_STEP_SECONDS;
    return {
      state: { lastTapAt: Number.NEGATIVE_INFINITY, streakZone: zone, streakUntil: now + SEEK_STREAK_WINDOW_MS, streakSeconds },
      outcome: { kind: "seek", zone, deltaSeconds: zone === "rewind" ? -SEEK_STEP_SECONDS : SEEK_STEP_SECONDS, streakSeconds },
    };
  }
  if (isDoubleTap) return { state: createTapGestureState(), outcome: { kind: "like" } };
  return { state: { ...createTapGestureState(), lastTapAt: now }, outcome: { kind: "pending" } };
}
