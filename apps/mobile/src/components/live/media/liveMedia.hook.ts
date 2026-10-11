import { useEffect, useRef, useState } from "react";

import { canPreviewLiveHostingWithMocks, detectLiveHostingSupport } from "@/services/live/liveHostingSupport.service";

import { useKeepAwakeWhile, useLiveHostMedia, type LiveHostMedia } from "./liveHostMedia.hook";
import { useLiveRoomConnection, type LiveRoomConnection } from "./liveRoomConnection.hook";
import { useLiveViewerMedia, type LiveViewerMedia } from "./liveViewerMedia.hook";

export type LiveMediaMode = "livekit" | "mockPreview" | "noVideoEngine";

export interface LiveMedia {
  readonly mode: LiveMediaMode;
  readonly connection: LiveRoomConnection;
  readonly host: LiveHostMedia;
  readonly viewer: LiveViewerMedia;
}

export interface LiveMediaInput {
  readonly liveId: string;
  readonly hostId: string | null;
  readonly isLive: boolean;
  readonly hasJoined: boolean;
  readonly isPublisher: boolean;
  readonly onRoomClosed: () => void;
}

function readLiveMediaMode(): LiveMediaMode {
  if (canPreviewLiveHostingWithMocks()) return "mockPreview";
  return detectLiveHostingSupport() === "ready" ? "livekit" : "noVideoEngine";
}

export function useLiveMedia({ liveId, hostId, isLive, hasJoined, isPublisher, onRoomClosed }: LiveMediaInput): LiveMedia {
  const [mode] = useState(readLiveMediaMode);
  const isActive = mode === "livekit" && hasJoined && isLive;
  const connection = useLiveRoomConnection(liveId, { isEnabled: isActive, isPublisher });
  const host = useLiveHostMedia(connection, isActive && isPublisher);
  const viewer = useLiveViewerMedia(connection, hostId ?? "");
  useKeepAwakeWhile(hasJoined && isLive && (mode === "livekit" || isPublisher));
  const latestOnRoomClosed = useRef(onRoomClosed);
  useEffect(() => {
    latestOnRoomClosed.current = onRoomClosed;
  });

  useEffect(() => {
    if (connection.status === "ended") latestOnRoomClosed.current();
  }, [connection.status]);

  return { mode, connection, host, viewer };
}
