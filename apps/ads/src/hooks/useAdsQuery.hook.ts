"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useOnReconnect } from "@zudomart/web-kit";

import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";

export interface AdsQueryState<Data> {
  readonly data: Data | null;
  readonly errorMessage: string | null;
  readonly error: unknown;
  readonly isLoading: boolean;
  readonly reload: () => void;
  readonly replaceData: (updater: (current: Data | null) => Data | null) => void;
}

export function useAdsQuery<Data>(loadData: (signal: AbortSignal) => Promise<Data>, dependencyKey: string, isEnabled = true): AdsQueryState<Data> {
  const [data, setData] = useState<Data | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
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
    setError(null);
    loadDataRef
      .current(abortController.signal)
      .then((loaded) => {
        if (!abortController.signal.aborted) setData(loaded);
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted && !(error instanceof DOMException && error.name === "AbortError")) {
          setError(error);
          setErrorMessage(readErrorMessageForDisplay(error));
        }
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
  return { data, errorMessage, error, isLoading, reload, replaceData };
}
