import { Skeleton } from "@nantty/web-kit";

export default function AccountRouteLoading() {
  return (
    <div role="status" aria-label="Loading" style={{ display: "grid", gap: 16 }}>
      <Skeleton width="30%" height={28} />
      <Skeleton height={96} />
      <Skeleton height={96} />
    </div>
  );
}
