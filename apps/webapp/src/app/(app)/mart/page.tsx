import type { Metadata } from "next";

import { MartBrowser } from "@/components/commerce/martBrowser";
import { SearchScopeRegistrar } from "@/components/search/searchScopeRegistrar";

export const metadata: Metadata = { title: "Mart" };

export default function MartPage() {
  return (
    <>
      <SearchScopeRegistrar scope="mart" label="Mart" />
      <MartBrowser />
    </>
  );
}
