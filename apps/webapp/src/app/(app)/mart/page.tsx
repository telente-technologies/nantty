import type { Metadata } from "next";

import { MartBrowser } from "@/components/commerce/martBrowser";

export const metadata: Metadata = { title: "Mart" };

export default function MartPage() {
  return <MartBrowser />;
}
