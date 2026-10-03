import { Skeleton } from "@zudomart/web-kit";

export default function StudioRouteLoading() {
  return (
    <div role="status" aria-label="Loading" style={{ display: "grid", gap: 16 }}>
      <Skeleton width="30%" height={28} />
      <Skeleton height={72} />
      <Skeleton height={72} />
    </div>
  );
}
