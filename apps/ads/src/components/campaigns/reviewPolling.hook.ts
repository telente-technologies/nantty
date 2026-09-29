"use client";

import { useEffect, useRef } from "react";

export function useReloadWhileReviewIsPending(isReviewPending: boolean, reload: () => void, intervalInMilliseconds = 8000): void {
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);
  useEffect(() => {
    if (!isReviewPending) return;
    const intervalHandle = setInterval(() => reloadRef.current(), intervalInMilliseconds);
    return () => clearInterval(intervalHandle);
  }, [isReviewPending, intervalInMilliseconds]);
}
