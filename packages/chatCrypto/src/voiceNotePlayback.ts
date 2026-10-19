export type PlayPausePolygons = readonly [readonly number[], readonly number[]];

export const playIconPolygons: PlayPausePolygons = [
  [7, 4, 13, 7.6, 13, 16.4, 7, 20],
  [13, 7.6, 19, 12, 19, 12, 13, 16.4],
];
export const pauseIconPolygons: PlayPausePolygons = [
  [7, 5, 10.5, 5, 10.5, 19, 7, 19],
  [13.5, 5, 17, 5, 17, 19, 13.5, 19],
];
export const playPauseMorphMilliseconds = 220;
export const voiceNotePlaybackRates = [1, 1.5, 2] as const;
export type VoiceNotePlaybackRate = (typeof voiceNotePlaybackRates)[number];

export const easeOutQuart = (progress: number) => 1 - (1 - Math.min(1, Math.max(0, progress))) ** 4;

export function interpolatePlayPausePolygons(pauseProgress: number): PlayPausePolygons {
  const progress = Number.isFinite(pauseProgress) ? Math.min(1, Math.max(0, pauseProgress)) : 0;
  const blend = (from: readonly number[], to: readonly number[]) => from.map((value, index) => value + ((to[index] ?? value) - value) * progress);
  return [blend(playIconPolygons[0], pauseIconPolygons[0]), blend(playIconPolygons[1], pauseIconPolygons[1])];
}

const roundCoordinate = (value: number) => Math.round(value * 100) / 100;

export function polygonPathData(points: readonly number[]): string {
  const pairs: string[] = [];
  for (let index = 0; index + 1 < points.length; index += 2) pairs.push(`${roundCoordinate(points[index] ?? 0)} ${roundCoordinate(points[index + 1] ?? 0)}`);
  return pairs.length ? `M${pairs.join("L")}Z` : "";
}

export function formatVoiceNoteClock(seconds: number): string {
  const wholeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

export function nextVoiceNotePlaybackRate(current: number): VoiceNotePlaybackRate {
  const index = voiceNotePlaybackRates.indexOf(current as VoiceNotePlaybackRate);
  return voiceNotePlaybackRates[(index + 1) % voiceNotePlaybackRates.length] ?? 1;
}

export const formatVoiceNotePlaybackRate = (rate: number) => `${rate}×`;

export function seekFractionFromPosition(positionX: number, width: number): number {
  if (!Number.isFinite(positionX) || !Number.isFinite(width) || width <= 0) return 0;
  return Math.min(1, Math.max(0, positionX / width));
}

export function playedBarCount(playedFraction: number, barCount: number): number {
  if (!Number.isFinite(playedFraction) || barCount <= 0) return 0;
  return Math.round(Math.min(1, Math.max(0, playedFraction)) * barCount);
}

export interface ExclusivePlaybackCoordinator {
  readonly claim: (playerId: string, pause: () => void) => void;
  readonly release: (playerId: string, pause?: () => void) => void;
}

export function createExclusivePlaybackCoordinator(): ExclusivePlaybackCoordinator {
  let current: { readonly playerId: string; readonly pause: () => void } | null = null;
  return {
    claim: (playerId, pause) => {
      const previous = current;
      current = { playerId, pause };
      if (!previous || previous.playerId === playerId) return;
      try {
        previous.pause();
      } catch {
        return;
      }
    },
    release: (playerId, pause) => {
      if (current?.playerId !== playerId) return;
      if (pause === undefined || current.pause === pause) current = null;
    },
  };
}
