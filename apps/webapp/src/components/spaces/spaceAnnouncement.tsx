"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { spacesService } from "@/services/spaces.service";
import { spaceIdFromAnnouncement } from "@/utils/spaceAnnouncement.util";
import styles from "./spaces.module.css";
export function SpaceAnnouncement({ text }: { text: string }) {
  const id = spaceIdFromAnnouncement(text);
  const detail = useQuery({
    queryKey: ["spaces", id],
    queryFn: () => spacesService.detail(id!),
    enabled: !!id,
    refetchInterval: 30000,
  });
  if (!id) return null;
  const space = detail.data;
  return (
    <aside className={styles.card}>
      <div className={styles.copy}>
        <strong>Audio Space</strong>
        <span>
          {space?.state === "live"
            ? `${space.listenerCount} listening now`
            : space?.state === "scheduled" && space.scheduledAt
              ? new Date(space.scheduledAt).toLocaleString()
              : space?.state === "ended"
                ? "This Space has ended"
                : space?.state === "cancelled"
                  ? "This Space was cancelled"
                  : "Open the conversation"}
        </span>
      </div>
      <Link className={styles.button} href={`/spaces/${id}`}>
        {space?.state === "live" ? "Join Space" : "View Space"}
      </Link>
    </aside>
  );
}
