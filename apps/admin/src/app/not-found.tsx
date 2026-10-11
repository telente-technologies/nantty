import type { Metadata } from "next";

import { NotFoundScreen } from "@zudomart/web-kit";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFoundPage() {
  return (
    <main id="main-content">
      <NotFoundScreen title="This console page doesn't exist" description="The link may be old, or the record moved. Nothing was changed." />
    </main>
  );
}
