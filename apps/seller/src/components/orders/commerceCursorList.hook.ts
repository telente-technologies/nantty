"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { readErrorMessageForDisplay, sendSellerApiRequest, type SellerApiRequestOptions } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";

export interface CommerceCursorListState<Item, Page extends CursorPage<Item>> {
  readonly items: Item[];
  readonly firstPage: Page | null;
  readonly isLoading: boolean;
  readonly isLoadingMore: boolean;
  readonly errorMessage: string | null;
  readonly error: unknown;
  readonly hasMore: boolean;
  readonly loadMore: () => void;
  readonly reload: () => void;
}

export function useCommerceCursorList<Item, Page extends CursorPage<Item> = CursorPage<Item>>(apiPath: string, query: SellerApiRequestOptions["query"]): CommerceCursorListState<Item, Page> {
  const [items, setItems] = useState<Item[]>([]);
  const [firstPage, setFirstPage] = useState<Page | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadCounter, setReloadCounter] = useState(0);
  const serialisedQuery = JSON.stringify(query ?? {});
  const latestQueryRef = useRef(query);
  latestQueryRef.current = query;

  useEffect(() => {
    const abortController = new AbortController();
    setIsLoading(true);
    setErrorMessage(null);
    setError(null);
    sendSellerApiRequest<Page>(apiPath, { query: latestQueryRef.current, signal: abortController.signal })
      .then((page) => {
        setFirstPage(page);
        setItems(page.data);
        setNextCursor(page.nextCursor);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setErrorMessage(readErrorMessageForDisplay(error));
        setError(error);
        setItems([]);
      })
      .finally(() => {
        if (!abortController.signal.aborted) setIsLoading(false);
      });
    return () => abortController.abort();
  }, [apiPath, serialisedQuery, reloadCounter]);

  const loadMore = useCallback(() => {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    sendSellerApiRequest<Page>(apiPath, { query: { ...latestQueryRef.current, cursor: nextCursor } })
      .then((page) => {
        setItems((current) => [...current, ...page.data]);
        setNextCursor(page.nextCursor);
      })
      .catch((caught: unknown) => {
        setErrorMessage(readErrorMessageForDisplay(caught));
        setError(caught);
      })
      .finally(() => setIsLoadingMore(false));
  }, [apiPath, nextCursor]);

  const reload = useCallback(() => setReloadCounter((counter) => counter + 1), []);
  return { items, firstPage, isLoading, isLoadingMore, errorMessage, error, hasMore: nextCursor !== null, loadMore, reload };
}
