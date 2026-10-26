import type { Metadata } from "next";

import { NotFoundScreen } from "@nantty/web-kit";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFoundPage() {
  return (
    <main id="main-content">
      <NotFoundScreen title="Not in stock" description="We couldn't find that page. The link may be old or have a typo. Your store and orders are safe." />
    </main>
  );
}
