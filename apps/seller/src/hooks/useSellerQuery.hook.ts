"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useOnReconnect } from "@nantty/web-kit";

import { readErrorMessageForDisplay, sendSellerApiRequest, type SellerApiRequestOptions } from "@/services/clientApi.service";

export interface SellerQueryState<Payload> {
  readonly data: Payload | null;
  readonly errorMessage: string | null;
  readonly error: unknown;
  readonly isLoading: boolean;
  readonly reload: () => void;
  readonly replaceData: (updater: (current: Payload | null) => Payload | null) => void;
}

export function useSellerQuery<Payload>(apiPath: string | null, query?: SellerApiRequestOptions["query"]): SellerQueryState<Payload> {
  const [data, setData] = useState<Payload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(apiPath !== null);
  const [reloadCounter, setReloadCounter] = useState(0);
  const serialisedQuery = JSON.stringify(query ?? {});
  const latestQueryRef = useRef(query);
  latestQueryRef.current = query;

  useEffect(() => {
    if (!apiPath) {
      setIsLoading(false);
      return;
    }
    const abortController = new AbortController();
    setIsLoading(true);
    setErrorMessage(null);
    setError(null);
    sendSellerApiRequest<Payload>(apiPath, { query: latestQueryRef.current, signal: abortController.signal })
      .then((payload) => setData(payload))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setError(error);
        setErrorMessage(readErrorMessageForDisplay(error));
      })
      .finally(() => {
        if (!abortController.signal.aborted) setIsLoading(false);
      });
    return () => abortController.abort();
  }, [apiPath, serialisedQuery, reloadCounter]);

  const reload = useCallback(() => setReloadCounter((counter) => counter + 1), []);
  useOnReconnect(() => {
    if (errorMessage) reload();
  });
  const replaceData = useCallback((updater: (current: Payload | null) => Payload | null) => setData((current) => updater(current)), []);
  return { data, errorMessage, error, isLoading, reload, replaceData };
}
