import { easeOutQuart, playPauseMorphMilliseconds } from "@nantty/chat-crypto";
import { useEffect, useRef, useState } from "react";

export function usePlayPauseMorphProgress(isPlaying: boolean, reduceMotion: boolean) {
  const target = isPlaying ? 1 : 0;
  const [progress, setProgress] = useState(target);
  const progressRef = useRef(target);
  useEffect(() => {
    if (reduceMotion || progressRef.current === target) {
      progressRef.current = target;
      setProgress(target);
      return;
    }
    const from = progressRef.current;
    const startedAt = Date.now();
    let frame = requestAnimationFrame(function step() {
      const elapsed = Math.min(1, (Date.now() - startedAt) / playPauseMorphMilliseconds);
      progressRef.current = from + (target - from) * easeOutQuart(elapsed);
      setProgress(progressRef.current);
      if (elapsed < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [reduceMotion, target]);
  return progress;
}
