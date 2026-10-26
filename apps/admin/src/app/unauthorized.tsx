import type { Metadata } from "next";
import { ErrorScreen } from "@nantty/web-kit";

export const metadata: Metadata = { title: "Sign in to continue", robots: { index: false } };

export default function UnauthorizedPage() {
  return (
    <main id="main-content">
      <ErrorScreen kind="signedOut" />
    </main>
  );
}
