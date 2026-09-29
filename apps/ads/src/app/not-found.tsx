import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" style={{ display: "grid", placeItems: "center", minHeight: "70dvh", textAlign: "center", padding: 24, gap: 8 }}>
      <div>
        <h1>Page not found</h1>
        <p style={{ color: "var(--ink-muted)", margin: "8px 0 16px" }}>The link may be old, or the item was deleted.</p>
        <Link href="/accounts">Go to your ad accounts</Link>
      </div>
    </main>
  );
}
