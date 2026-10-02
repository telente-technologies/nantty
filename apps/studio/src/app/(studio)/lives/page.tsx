"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Spinner } from "@/components/ui/feedback";
import { livesService } from "@/services/lives.service";
import type { LiveSession, LiveState } from "@/types";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import styles from "./page.module.css";

const STATE_LABEL: Record<LiveState, string> = { idle: "Ready", connecting: "Connecting", live: "Live", ended: "Ended" };

export default function LivesDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const lives = useQuery({ queryKey: ["lives"], queryFn: () => livesService.listLives() });

  const createLive = useMutation({
    mutationFn: () => livesService.createLive(title.trim() || "Untitled live"),
    onSuccess: (live) => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["lives"] });
      router.push(`/lives/${live.id}`);
    },
    onError: (error: Error) => setFormError(error.message),
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    createLive.mutate();
  }

  if (lives.isLoading) return <Spinner label="Loading lives" />;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Lives</h1>
          <p className={styles.subtitle}>Start a stream from here, in OBS, or from your phone.</p>
        </div>
      </header>

      <form className={styles.createBar} onSubmit={handleCreate}>
        <TextField
          label="New live title"
          hideLabel
          name="title"
          placeholder="Give this live a title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Button type="submit" busy={createLive.isPending}>
          Create live
        </Button>
      </form>

      {formError ? (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      ) : null}

      <ul className={styles.list}>
        {(lives.data ?? []).map((live) => (
          <LiveRow key={live.id} live={live} />
        ))}
      </ul>

      {lives.data?.length === 0 ? <p className={styles.empty}>You haven&apos;t created a live yet.</p> : null}
    </div>
  );
}

function LiveRow({ live }: { readonly live: LiveSession }) {
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <div className={styles.rowTitleRow}>
          <span className={`${styles.stateBadge} ${styles[`state_${live.state}`]}`}>{STATE_LABEL[live.state]}</span>
          <span className={styles.rowTitle}>{live.title}</span>
        </div>
        <p className={styles.rowMeta}>
          {live.state === "ended" ? `Ended ${formatTimeSincePosted(live.endedAt ?? live.createdAt)}` : `Created ${formatTimeSincePosted(live.createdAt)}`}
          {" · "}
          {formatCountWithThousandsSuffix(live.peakViewers)} peak viewers
          {" · "}
          {live.products.length} products
        </p>
      </div>
      <div className={styles.rowActions}>
        <Link href={`/lives/${live.id}`} className={styles.rowLink}>
          Control room
        </Link>
        <Link href={`/lives/${live.id}/overlay`} className={styles.rowLinkMuted}>
          Overlay editor
        </Link>
      </div>
    </li>
  );
}
