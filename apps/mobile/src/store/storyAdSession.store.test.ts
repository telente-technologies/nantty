import { isStoryAdSlot, useStoryAdSessionStore } from "./storyAdSession.store";

describe("Story ad session cadence", () => {
  beforeEach(() => {
    useStoryAdSessionStore.getState().reset();
  });

  it("requests server decisions only at the existing conservative session slots", () => {
    const candidateSlots = Array.from({ length: 13 }, (_, index) => index + 1).filter(isStoryAdSlot);

    expect(candidateSlots).toEqual([3, 8, 13]);
  });

  it("counts each displayed story in the session, independent of seen status", () => {
    const session = useStoryAdSessionStore.getState();

    expect(session.recordStoryViewed()).toBe(1);
    expect(session.recordStoryViewed()).toBe(2);
    expect(session.recordStoryViewed()).toBe(3);
    expect(useStoryAdSessionStore.getState().viewedCount).toBe(3);
    expect(isStoryAdSlot(useStoryAdSessionStore.getState().viewedCount)).toBe(true);
  });
});
