import { advanceClipWatchSession, createClipWatchSession, markClipWatchSeek, summarizeClipWatchSession } from "../clipWatchSession.util";

const play = (session: ReturnType<typeof createClipWatchSession>, seconds: readonly number[], duration: number) => {
  for (const second of seconds) advanceClipWatchSession(session, second, duration);
};

describe("clip watch time with seeks", () => {
  it("counts only the seconds actually played around a 10s skip ahead", () => {
    const session = createClipWatchSession();
    play(session, [0, 1, 2], 60);
    markClipWatchSeek(session, 12);
    play(session, [12, 13, 14], 60);
    expect(summarizeClipWatchSession(session, 60).watchMs).toBe(4000);
  });

  it("does not count a short scrub ahead as watched", () => {
    const session = createClipWatchSession();
    play(session, [0, 1, 2], 60);
    markClipWatchSeek(session, 4.5);
    play(session, [4.5, 5.5], 60);
    expect(summarizeClipWatchSession(session, 60).watchMs).toBe(3000);
  });

  it("does not mistake scrubbing back from the end for a loop", () => {
    const session = createClipWatchSession();
    play(session, [0, 2, 4, 6, 8, 9], 10);
    markClipWatchSeek(session, 0.5);
    play(session, [0.5, 1.5], 10);
    expect(summarizeClipWatchSession(session, 10)).toMatchObject({ watchMs: 10_000, loopCount: 0 });
  });

  it("ignores stale samples that arrive before the seek lands", () => {
    const session = createClipWatchSession();
    play(session, [7, 8], 10);
    markClipWatchSeek(session, 1);
    play(session, [8.25, 1, 2], 10);
    expect(summarizeClipWatchSession(session, 10)).toMatchObject({ watchMs: 2000, loopCount: 0 });
  });

  it("resumes counting if the player never reports the seek target", () => {
    const session = createClipWatchSession();
    markClipWatchSeek(session, 30);
    play(session, [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25], 60);
    expect(summarizeClipWatchSession(session, 60).watchMs).toBe(500);
  });

  it("still counts a natural loop after a rewind", () => {
    const session = createClipWatchSession();
    play(session, [0, 1, 2, 3, 4, 5, 6, 7, 8], 10);
    markClipWatchSeek(session, 7);
    play(session, [7, 8, 9, 9.5, 0.5], 10);
    expect(summarizeClipWatchSession(session, 10)).toMatchObject({ watchMs: 11_500, loopCount: 1 });
  });
});
