export const IMPRESSION_MINIMUM_VISIBLE_FRACTION = 0.5;
export const IMPRESSION_MINIMUM_VISIBLE_MS = 1_000;

export type ImpressionStep = { readonly kind: "view" } | { readonly kind: "dwell"; readonly dwellMs: number } | null;

export interface ImpressionSession {
  visibleSince: number | null;
  qualified: boolean;
}

export const createImpressionSession = (): ImpressionSession => ({ visibleSince: null, qualified: false });

export function visibleFractionOf(frame: { x: number; y: number; width: number; height: number }, viewport: { width: number; height: number }): number {
  if (frame.width <= 0 || frame.height <= 0) return 0;
  const overlapX = Math.max(0, Math.min(frame.x + frame.width, viewport.width) - Math.max(frame.x, 0));
  const overlapY = Math.max(0, Math.min(frame.y + frame.height, viewport.height) - Math.max(frame.y, 0));
  const visibleArea = overlapX * overlapY;
  const viewportArea = viewport.width * viewport.height;
  const frameArea = frame.width * frame.height;
  return Math.min(1, visibleArea / Math.min(frameArea, viewportArea));
}

export function advanceImpressionSession(session: ImpressionSession, visibleFraction: number, now: number): ImpressionStep {
  if (visibleFraction >= IMPRESSION_MINIMUM_VISIBLE_FRACTION) {
    if (session.visibleSince === null) session.visibleSince = now;
    if (!session.qualified && now - session.visibleSince >= IMPRESSION_MINIMUM_VISIBLE_MS) {
      session.qualified = true;
      return { kind: "view" };
    }
    return null;
  }
  return endImpressionSession(session, now);
}

export function endImpressionSession(session: ImpressionSession, now: number): ImpressionStep {
  const { visibleSince, qualified } = session;
  session.visibleSince = null;
  session.qualified = false;
  return qualified && visibleSince !== null ? { kind: "dwell", dwellMs: now - visibleSince } : null;
}
