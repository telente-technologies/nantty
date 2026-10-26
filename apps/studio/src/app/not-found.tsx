import type { Metadata } from "next";

import { NotFoundScreen } from "@nantty/web-kit";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFoundPage() {
  return (
    <main id="main-content">
      <NotFoundScreen title="This page wandered off the stage" description="The link may be old or have a typo. Your content and lives are safe." />
    </main>
  );
}
