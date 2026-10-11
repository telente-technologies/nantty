import { useEffect, useState } from "react";

import { remainingSeconds } from "./retryCountdown";

export function useRetryCountdown(retryAfterSeconds: number | undefined): number {
  const [deadline] = useState(() => (retryAfterSeconds ? Date.now() + retryAfterSeconds * 1000 : 0));
  const [secondsLeft, setSecondsLeft] = useState(retryAfterSeconds ?? 0);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => setSecondsLeft(remainingSeconds(deadline, Date.now()));
    tick();
    const interval = setInterval(() => {
      tick();
      if (remainingSeconds(deadline, Date.now()) === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);
  return secondsLeft;
}
