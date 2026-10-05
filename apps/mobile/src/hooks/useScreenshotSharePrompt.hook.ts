import * as ScreenCapture from "expo-screen-capture";
import { useEffect, useRef } from "react";

import { useMediaDownloadStore } from "@/store/mediaDownload.store";
import type { Post } from "@/types";

export function useScreenshotSharePrompt(post: Post | null | undefined, isViewing: boolean) {
  const latestPost = useRef(post);
  const showScreenshotPrompt = useMediaDownloadStore((state) => state.showScreenshotPrompt);

  useEffect(() => {
    latestPost.current = post;
  }, [post]);

  useEffect(() => {
    if (!isViewing || !post?.id) return;
    let subscription: ReturnType<typeof ScreenCapture.addScreenshotListener> | null = null;
    try {
      subscription = ScreenCapture.addScreenshotListener(() => {
        if (latestPost.current) showScreenshotPrompt(latestPost.current);
      });
    } catch {
      subscription = null;
    }
    return () => subscription?.remove();
  }, [isViewing, post?.id, showScreenshotPrompt]);
}
