"use client";

import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { showToast } from "@/components/ui/toast";
import { isRetryableApiFailure } from "@/services/clientApi.service";
import { COMMENTS_UPDATED_TOAST, isCommentsCursorExpiredError, restartCommentsListFromTop } from "@/utils/commentsCursor.util";

export const retryCommentsPageUnlessCursorExpired = (failureCount: number, error: unknown): boolean =>
  !isCommentsCursorExpiredError(error) && failureCount < 2 && isRetryableApiFailure(error);

export function useRestartCommentsOnExpiredCursor(queryKey: QueryKey, error: unknown, onRestartedFromTop?: () => void) {
  const queryClient = useQueryClient();
  const keyHash = JSON.stringify(queryKey);
  const [restartedKeyHash, setRestartedKeyHash] = useState<string | null>(null);
  const onRestartedRef = useRef(onRestartedFromTop);
  useEffect(() => {
    onRestartedRef.current = onRestartedFromTop;
  });
  const willRestart = isCommentsCursorExpiredError(error) && restartedKeyHash !== keyHash;

  useEffect(() => {
    if (!willRestart) return;
    setRestartedKeyHash(keyHash);
    const restart = restartCommentsListFromTop(queryClient, queryKey);
    onRestartedRef.current?.();
    restart.then(() => showToast({ text: COMMENTS_UPDATED_TOAST })).catch(() => undefined);
  }, [willRestart, keyHash]);

  return { isRestartingFromTop: willRestart };
}
