"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useOnReconnect } from "@nantty/web-kit";

import { readErrorMessageForDisplay, sendSellerApiRequest, type SellerApiRequestOptions } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";

export interface CursorPagedListState<Item> {
  readonly items: Item[] | null;
  readonly errorMessage: string | null;
  readonly error: unknown;
  readonly isLoading: boolean;
  readonly isLoadingMore: boolean;
  readonly hasMore: boolean;
  readonly loadMore: () => void;
  readonly reload: () => void;
}

export function useCursorPagedList<Item>(apiPath: string, query: SellerApiRequestOptions["query"]): CursorPagedListState<Item> {
  const [items, setItems] = useState<Item[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reloadCounter, setReloadCounter] = useState(0);
  const serialisedQuery = JSON.stringify(query ?? {});
  const latestQueryRef = useRef(query);
  latestQueryRef.current = query;

  useEffect(() => {
    const abortController = new AbortController();
    setIsLoading(true);
    setErrorMessage(null);
    setError(null);
    sendSellerApiRequest<CursorPage<Item>>(apiPath, { query: latestQueryRef.current, signal: abortController.signal })
      .then((page) => {
        setItems(page.data);
        setNextCursor(page.nextCursor);
      })
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

  const loadMore = useCallback(() => {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    sendSellerApiRequest<CursorPage<Item>>(apiPath, { query: { ...latestQueryRef.current, cursor: nextCursor } })
      .then((page) => {
        setItems((current) => [...(current ?? []), ...page.data]);
        setNextCursor(page.nextCursor);
      })
      .catch((error: unknown) => {
        setError(error);
        setErrorMessage(readErrorMessageForDisplay(error));
      })
      .finally(() => setIsLoadingMore(false));
  }, [apiPath, nextCursor]);

  const reload = useCallback(() => setReloadCounter((counter) => counter + 1), []);
  useOnReconnect(() => {
    if (errorMessage) reload();
  });
  return { items, errorMessage, error, isLoading, isLoadingMore, hasMore: nextCursor !== null, loadMore, reload };
}
