import { Skeleton } from "@nantty/web-kit";

export default function ConsoleRouteLoading() {
  return (
    <div role="status" aria-label="Loading" style={{ display: "grid", gap: 16 }}>
      <Skeleton width="30%" height={24} />
      <Skeleton height={88} />
      <Skeleton height={240} />
    </div>
  );
}
