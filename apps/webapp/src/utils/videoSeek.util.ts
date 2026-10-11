export const ARROW_SEEK_SECONDS = 5;
export const JUMP_SEEK_SECONDS = 10;
export const MINIMUM_SCRUBBABLE_SECONDS = 5;
const END_GUARD_SECONDS = 0.25;

export type VideoShortcut = { readonly kind: "seek"; readonly deltaSeconds: number } | { readonly kind: "togglePlay" };

export const clampFraction = (fraction: number) => (Number.isFinite(fraction) ? Math.min(Math.max(fraction, 0), 1) : 0);

export const fractionFromPointer = (clientX: number, trackLeft: number, trackWidth: number) => (trackWidth > 0 ? clampFraction((clientX - trackLeft) / trackWidth) : 0);

export function clampSeekSeconds(targetSeconds: number, durationSeconds: number): number {
  if (!Number.isFinite(targetSeconds)) return 0;
  if (!(durationSeconds > 0) || !Number.isFinite(durationSeconds)) return Math.max(targetSeconds, 0);
  return Math.min(Math.max(targetSeconds, 0), Math.max(durationSeconds - END_GUARD_SECONDS, 0));
}

export const secondsAtFraction = (fraction: number, durationSeconds: number) => clampSeekSeconds(clampFraction(fraction) * Math.max(durationSeconds, 0), durationSeconds);

export const isScrubbableDuration = (durationSeconds: number) => Number.isFinite(durationSeconds) && durationSeconds >= MINIMUM_SCRUBBABLE_SECONDS;

export function formatPlaybackTime(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = String(safe % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

export function videoShortcutFor(key: string, hasModifier: boolean): VideoShortcut | null {
  if (hasModifier) return null;
  switch (key) {
    case "ArrowLeft":
      return { kind: "seek", deltaSeconds: -ARROW_SEEK_SECONDS };
    case "ArrowRight":
      return { kind: "seek", deltaSeconds: ARROW_SEEK_SECONDS };
    case "j":
    case "J":
      return { kind: "seek", deltaSeconds: -JUMP_SEEK_SECONDS };
    case "l":
    case "L":
      return { kind: "seek", deltaSeconds: JUMP_SEEK_SECONDS };
    case "k":
    case "K":
    case " ":
      return { kind: "togglePlay" };
    default:
      return null;
  }
}

export function bufferedEndAround(ranges: readonly (readonly [number, number])[], currentSeconds: number): number {
  const containing = ranges.find(([start, end]) => currentSeconds >= start && currentSeconds <= end);
  return containing ? containing[1] : 0;
}
