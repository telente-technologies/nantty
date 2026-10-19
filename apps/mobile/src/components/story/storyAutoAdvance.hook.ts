import { useEffect, useState } from "react";

const STORY_DURATION_MS = 5_000;
const TICK_MS = 50;

export function useStoryAutoAdvance(storyCount: number, paused: boolean, onFinishedAllStories: () => void) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (storyCount === 0 || paused) return;
    const timer = setInterval(() => {
      setProgress((p) => {
        const next = p + TICK_MS / STORY_DURATION_MS;
        if (next < 1) return next;
        setActiveIndex((i) => {
          if (i + 1 < storyCount) return i + 1;
          onFinishedAllStories();
          return i;
        });
        return 0;
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [storyCount, paused, onFinishedAllStories]);

  const goToNextStory = () => {
    if (activeIndex + 1 < storyCount) {
      setActiveIndex(activeIndex + 1);
      setProgress(0);
    } else onFinishedAllStories();
  };
  const goToPreviousStory = () => {
    setActiveIndex(Math.max(0, activeIndex - 1));
    setProgress(0);
  };
  const goToLastStory = () => {
    setActiveIndex(Math.max(0, storyCount - 1));
    setProgress(0);
  };

  return { activeIndex, progress, goToNextStory, goToPreviousStory, goToLastStory };
}
