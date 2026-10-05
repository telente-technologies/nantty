"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useOnReconnect } from "@zudomart/web-kit";

import { readErrorMessageForDisplay } from "@/services/adminApiClient.service";

export interface AdminQueryState<Data> {
  readonly data: Data | null;
  readonly errorMessage: string | null;
  readonly isLoading: boolean;
  readonly reload: () => void;
  readonly replaceData: (updater: (current: Data | null) => Data | null) => void;
}

export function useAdminQuery<Data>(loadData: (signal: AbortSignal) => Promise<Data>, dependencyKey: string, isEnabled = true): AdminQueryState<Data> {
  const [data, setData] = useState<Data | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isEnabled);
  const [reloadCounter, setReloadCounter] = useState(0);
  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  useEffect(() => {
    if (!isEnabled) {
      setIsLoading(false);
      return;
    }
    const abortController = new AbortController();
    setIsLoading(true);
    setErrorMessage(null);
    loadDataRef
      .current(abortController.signal)
      .then((loaded) => {
        if (!abortController.signal.aborted) setData(loaded);
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted && !(error instanceof DOMException && error.name === "AbortError")) setErrorMessage(readErrorMessageForDisplay(error));
      })
      .finally(() => {
        if (!abortController.signal.aborted) setIsLoading(false);
      });
    return () => abortController.abort();
  }, [dependencyKey, reloadCounter, isEnabled]);

  const reload = useCallback(() => setReloadCounter((current) => current + 1), []);
  useOnReconnect(() => {
    if (errorMessage) reload();
  });
  const replaceData = useCallback((updater: (current: Data | null) => Data | null) => setData(updater), []);
  return { data, errorMessage, isLoading, reload, replaceData };
}
