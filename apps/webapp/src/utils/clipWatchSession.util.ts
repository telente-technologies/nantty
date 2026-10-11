export interface ClipWatchSession {
  watchedSeconds: number;
  lastSeconds: number | null;
  furthestSeconds: number;
  loops: number;
  seekTargetSeconds: number | null;
  samplesSinceSeek: number;
}

const MAXIMUM_NATURAL_STEP_SECONDS = 3;
const LOOP_END_FRACTION = 0.8;
const LOOP_START_FRACTION = 0.2;
const SEEK_LANDING_TOLERANCE_SECONDS = 1;
const MAXIMUM_SAMPLES_BEFORE_SEEK_LANDS = 8;

export const createClipWatchSession = (): ClipWatchSession => ({ watchedSeconds: 0, lastSeconds: null, furthestSeconds: 0, loops: 0, seekTargetSeconds: null, samplesSinceSeek: 0 });

export function markClipWatchSeek(session: ClipWatchSession, targetSeconds: number): void {
  session.lastSeconds = null;
  session.seekTargetSeconds = Number.isFinite(targetSeconds) ? Math.max(targetSeconds, 0) : null;
  session.samplesSinceSeek = 0;
}

function isStaleSampleBeforeSeekLands(session: ClipWatchSession, currentSeconds: number): boolean {
  if (session.seekTargetSeconds === null) return false;
  session.samplesSinceSeek += 1;
  const landed = Math.abs(currentSeconds - session.seekTargetSeconds) <= SEEK_LANDING_TOLERANCE_SECONDS;
  if (!landed && session.samplesSinceSeek < MAXIMUM_SAMPLES_BEFORE_SEEK_LANDS) return true;
  session.seekTargetSeconds = null;
  return false;
}

export function advanceClipWatchSession(session: ClipWatchSession, currentSeconds: number, durationSeconds: number): void {
  if (!Number.isFinite(currentSeconds) || currentSeconds < 0) return;
  if (isStaleSampleBeforeSeekLands(session, currentSeconds)) return;
  const last = session.lastSeconds;
  if (last !== null) {
    const step = currentSeconds - last;
    if (step > 0 && step <= MAXIMUM_NATURAL_STEP_SECONDS) session.watchedSeconds += step;
    const wrapped = step < 0 && durationSeconds > 0 && last >= durationSeconds * LOOP_END_FRACTION && currentSeconds <= durationSeconds * LOOP_START_FRACTION;
    if (wrapped) {
      session.loops += 1;
      session.watchedSeconds += Math.max(0, durationSeconds - last) + currentSeconds;
    }
  }
  session.lastSeconds = currentSeconds;
  session.furthestSeconds = Math.max(session.furthestSeconds, currentSeconds);
}

export function summarizeClipWatchSession(session: ClipWatchSession, durationSeconds: number) {
  const watchFraction = session.loops > 0 ? 1 : durationSeconds > 0 ? Math.min(1, session.furthestSeconds / durationSeconds) : 0;
  return {
    watchMs: Math.round(session.watchedSeconds * 1000),
    durationMs: Math.round(Math.max(0, durationSeconds) * 1000),
    watchFraction: Math.round(watchFraction * 1000) / 1000,
    loopCount: session.loops,
  };
}
