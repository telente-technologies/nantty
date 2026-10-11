import { useQueryClient, type InfiniteData, type QueryKey } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { ApiError } from "@/errors/api.error";
import { showToast } from "@/store/toast.store";

export const COMMENTS_UPDATED_TOAST = "Comments updated";

export const isCommentsCursorExpiredError = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 400 && error.code === "CURSOR_EXPIRED";

export const retryCommentsPageUnlessCursorExpired = (failureCount: number, error: unknown): boolean =>
  !isCommentsCursorExpiredError(error) && !(error instanceof ApiError && error.status === 401) && failureCount < 1;

export const keepOnlyFirstCommentsPage = <TPage, TParam>(data: InfiniteData<TPage, TParam> | undefined): InfiniteData<TPage, TParam> | undefined =>
  data && data.pages.length > 0 ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) } : data;

export function useRestartCommentsOnExpiredCursor(queryKey: QueryKey, error: unknown, onRestartedFromTop?: () => void) {
  const queryClient = useQueryClient();
  const keyHash = JSON.stringify(queryKey);
  const [restartedKeyHash, setRestartedKeyHash] = useState<string | null>(null);
  const onRestartedRef = useRef(onRestartedFromTop);
  useEffect(() => {
    onRestartedRef.current = onRestartedFromTop;
  });
  const isExpired = isCommentsCursorExpiredError(error);
  const willRestart = isExpired && restartedKeyHash !== keyHash;

  useEffect(() => {
    if (!willRestart) return;
    setRestartedKeyHash(keyHash);
    const existing = queryClient.getQueryData<InfiniteData<unknown, unknown>>(queryKey);
    if (existing) queryClient.setQueryData(queryKey, keepOnlyFirstCommentsPage(existing));
    onRestartedRef.current?.();
    const refetch = existing
      ? queryClient.refetchQueries({ queryKey, exact: true }, { throwOnError: true })
      : queryClient.resetQueries({ queryKey, exact: true }, { throwOnError: true });
    refetch.then(() => showToast(COMMENTS_UPDATED_TOAST)).catch(() => undefined);
  }, [willRestart, keyHash]);

  return { isRestartingFromTop: willRestart };
}
