import { Skeleton } from "@nantty/web-kit";

export default function RootRouteLoading() {
  return (
    <main role="status" aria-label="Loading" style={{ display: "grid", gap: 16, maxWidth: 960, margin: "0 auto", padding: "48px 16px" }}>
      <Skeleton width="30%" height={28} />
      <Skeleton height={96} />
      <Skeleton height={96} />
    </main>
  );
}
