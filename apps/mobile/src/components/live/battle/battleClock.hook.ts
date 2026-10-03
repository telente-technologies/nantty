import { useEffect, useState } from "react";

const CLOCK_TICK_MS = 250;

export function useTickingServerNow(serverClockOffsetMs: number, isTicking: boolean) {
  const [now, setNow] = useState(() => Date.now() + serverClockOffsetMs);
  useEffect(() => {
    if (!isTicking) return;
    setNow(Date.now() + serverClockOffsetMs);
    const interval = setInterval(() => setNow(Date.now() + serverClockOffsetMs), CLOCK_TICK_MS);
    return () => clearInterval(interval);
  }, [serverClockOffsetMs, isTicking]);
  return now;
}

export const secondsRemainingUntil = (isoTime: string, now: number) => Math.max(0, Math.ceil((Date.parse(isoTime) - now) / 1000));

export const formatBattleClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
