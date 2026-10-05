"use client";

import { useEffect } from "react";

import { useSearchScopeStore } from "@/store/searchScope.store";
import type { SearchScopeKey } from "@/types/search.type";

export function SearchScopeRegistrar({ scope, label }: { readonly scope: SearchScopeKey; readonly label: string }) {
  const setPageContext = useSearchScopeStore((state) => state.setPageContext);
  useEffect(() => {
    setPageContext({ scope, label });
    return () => setPageContext(null);
  }, [scope, label, setPageContext]);
  return null;
}
