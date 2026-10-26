import type { Metadata } from "next";

import { NotFoundScreen } from "@nantty/web-kit";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFoundPage() {
  return (
    <main id="main-content">
      <NotFoundScreen title="This page ran out of budget" description="The link may be old, or the campaign, ad or page was deleted. Nothing was charged." />
    </main>
  );
}
