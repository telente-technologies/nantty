"use client";

import { useCallback, useEffect, useState } from "react";

export function useResendCountdown(totalSeconds: number) {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [restartKey, setRestartKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setSecondsLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(interval);
  }, [restartKey]);

  const restart = useCallback(() => {
    setSecondsLeft(totalSeconds);
    setRestartKey((key) => key + 1);
  }, [totalSeconds]);

  return { secondsLeft, restart };
}
