"use client";

import { useCallback, useEffect, useState } from "react";

import { readErrorMessageForDisplay, sendSellerApiRequest, type SellerApiRequestOptions } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";

export function useWalletCursorPages<Item>(apiPath: string, query: SellerApiRequestOptions["query"]) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);
  const serialisedQuery = JSON.stringify(query ?? {});

  useEffect(() => {
    const abortController = new AbortController();
    setIsLoading(true);
    setErrorMessage(null);
    sendSellerApiRequest<CursorPage<Item>>(apiPath, { query: JSON.parse(serialisedQuery) as SellerApiRequestOptions["query"], signal: abortController.signal })
      .then((page) => {
        setItems(page.data);
        setNextCursor(page.nextCursor);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setErrorMessage(readErrorMessageForDisplay(error));
      })
      .finally(() => {
        if (!abortController.signal.aborted) setIsLoading(false);
      });
    return () => abortController.abort();
  }, [apiPath, serialisedQuery, reloadCounter]);

  const loadNextPage = useCallback(async () => {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const page = await sendSellerApiRequest<CursorPage<Item>>(apiPath, { query: { ...(JSON.parse(serialisedQuery) as Record<string, string>), cursor: nextCursor } });
      setItems((current) => [...(current ?? []), ...page.data]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsLoadingMore(false);
    }
  }, [apiPath, serialisedQuery, nextCursor]);

  const reload = useCallback(() => setReloadCounter((counter) => counter + 1), []);
  return { items, hasMore: nextCursor !== null, isLoading, isLoadingMore, errorMessage, loadNextPage, reload };
}
