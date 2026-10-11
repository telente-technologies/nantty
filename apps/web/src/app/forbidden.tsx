import type { Metadata } from "next";
import { ErrorScreen } from "@zudomart/web-kit";

export const metadata: Metadata = { title: "You don't have access", robots: { index: false } };

export default function ForbiddenPage() {
  return (
    <main id="main-content">
      <ErrorScreen kind="forbidden" />
    </main>
  );
}
