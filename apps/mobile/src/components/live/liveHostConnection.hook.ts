import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { liveService } from "@/services/live/live.service";
import { useOfflineStore } from "@/store/offline.store";

import { classifyHeartbeatOutcome } from "./liveHostConnection.util";

export const HOST_HEARTBEAT_INTERVAL_MS = 15_000;

export type LiveHostConnection = "connected" | "reconnecting";

export function useLiveHostConnection(liveId: string, isEnabled: boolean, onLiveEnded: () => void): LiveHostConnection {
  const isOnline = useOfflineStore((state) => state.isOnline);
  const [hasHeartbeatFailed, setHasHeartbeatFailed] = useState(false);
  const latestOnLiveEnded = useRef(onLiveEnded);
  useEffect(() => {
    latestOnLiveEnded.current = onLiveEnded;
  });

  useEffect(() => {
    if (!isEnabled) return undefined;
    let isActive = true;
    let isStopped = false;
    const beat = () => {
      if (isStopped) return;
      liveService
        .sendHostHeartbeat(liveId)
        .then((heartbeat) => ({ heartbeat }), (error: unknown) => ({ error }))
        .then((result) => {
          if (!isActive) return;
          const outcome = classifyHeartbeatOutcome(result);
          setHasHeartbeatFailed(outcome === "reconnecting");
          if (outcome === "stop" || outcome === "ended") isStopped = true;
          if (outcome === "ended") latestOnLiveEnded.current();
        });
    };
    beat();
    const timer = setInterval(beat, HOST_HEARTBEAT_INTERVAL_MS);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") beat();
    });
    return () => {
      isActive = false;
      clearInterval(timer);
      appState.remove();
    };
  }, [liveId, isEnabled, isOnline]);

  return isEnabled && (!isOnline || hasHeartbeatFailed) ? "reconnecting" : "connected";
}
