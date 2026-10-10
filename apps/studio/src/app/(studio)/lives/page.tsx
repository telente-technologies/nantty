"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ListPageSkeleton } from "@/components/ui/pageSkeletons";
import { PayoutSetupBanner } from "@/components/payouts/payoutSetupBanner";
import { LiveEarningsPanel } from "@/components/live/liveEarningsPanel";
import { LIVE_CATEGORY_LABELS, LIVE_CATEGORY_OPTIONS } from "@/constants/liveCategories.constant";
import { useSession } from "@/components/providers/sessionProvider";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { livesService } from "@/services/lives.service";
import type { LiveCategory, LiveEarnings, LiveSession, LiveState, StoreOption, User } from "@/types";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";
import { readLiveErrorMessage } from "@/utils/liveStoreErrors.util";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import styles from "./page.module.css";

const STATE_LABEL: Record<LiveState, string> = { idle: "Ready", connecting: "Connecting", live: "Live", ended: "Ended" };

const sumEarningsAcrossLives = (lives: readonly LiveSession[]): LiveEarnings => {
  const gifterCoins = new Map<string, { id: string; name: string; coins: number }>();
  lives.forEach((live) =>
    live.earnings.topGifters.forEach((gifter) => {
      const known = gifterCoins.get(gifter.name);
      gifterCoins.set(gifter.name, { ...gifter, coins: (known?.coins ?? 0) + gifter.coins });
    }),
  );
  return {
    coins: lives.reduce((total, live) => total + live.earnings.coins, 0),
    giftCount: lives.reduce((total, live) => total + live.earnings.giftCount, 0),
    newSubscribers: lives.reduce((total, live) => total + live.earnings.newSubscribers, 0),
    topGifters: [...gifterCoins.values()].sort((a, b) => b.coins - a.coins).slice(0, 5),
    battles: lives.flatMap((live) => live.earnings.battles),
  };
};

const NO_STORE = "";

const pickDefaultStore = (stores: readonly StoreOption[], viewer: User | null): string =>
  (stores.find((store) => store.id === viewer?.storeId) ?? stores.find((store) => store.isCurrent) ?? stores[0])?.id ?? NO_STORE;

export default function LivesDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { viewer } = useSession();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<LiveCategory>("justChatting");
  const [chosenStoreId, setChosenStoreId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const createInFlight = useRef(false);
  const lives = useQuery({ queryKey: ["lives"], queryFn: () => livesService.listLives() });
  const stores = useQuery({ queryKey: ["my-stores"], queryFn: () => livesService.listMyStores(), enabled: viewer !== null });
  const storeOptions = stores.data ?? [];
  const storeId = chosenStoreId ?? pickDefaultStore(storeOptions, viewer);
  const categoryOptions = LIVE_CATEGORY_OPTIONS.filter((option) => option.value !== "shopping" || storeId !== NO_STORE);
  const effectiveCategory = category === "shopping" && storeId === NO_STORE ? "justChatting" : category;

  const createLive = useMutation({
    mutationFn: () => livesService.createLive({ title: title.trim() || "Untitled live", category: effectiveCategory, storeId: storeId || null }),
    onSuccess: (live) => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["lives"] });
      router.push(`/lives/${live.id}`);
    },
    onError: (error: Error) => setFormError(readLiveErrorMessage(error)),
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (createInFlight.current) return;
    createInFlight.current = true;
    createLive.mutate(undefined, { onSettled: () => { createInFlight.current = false; } });
  }

  if (lives.isLoading) return <ListPageSkeleton label="Loading lives" />;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Lives</h1>
          <p className={styles.subtitle}>Talk, play, perform or teach. Start a stream from here, in OBS, or from your phone.</p>
        </div>
      </header>

      <PayoutSetupBanner />

      <form className={styles.createBar} onSubmit={handleCreate}>
        <div className={styles.createWrap}>
          <TextField
            label="Live title"
            name="title"
            placeholder="Give this live a title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <div className={styles.categoryRow} role="radiogroup" aria-label="Stream category">
            {categoryOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={effectiveCategory === option.value}
                className={`${styles.categoryChip} ${effectiveCategory === option.value ? styles.categoryChipActive : ""}`}
                onClick={() => setCategory(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {storeOptions.length > 0 ? (
            <SelectField
              label="Stream for"
              name="storeId"
              hint="Only lives started for a store can show and pin that store's products."
              value={storeId}
              onChange={(event) => setChosenStoreId(event.target.value)}
            >
              {storeOptions.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
              <option value={NO_STORE}>Just me (no products)</option>
            </SelectField>
          ) : null}
          {stores.isError ? <p className={styles.formError} role="alert">{readLiveErrorMessage(stores.error)}</p> : null}
        </div>
        <Button type="submit" busy={createLive.isPending} disabled={stores.isLoading}>
          Create live
        </Button>
      </form>

      {lives.data && lives.data.length > 0 ? (
        <LiveEarningsPanel
          earnings={sumEarningsAcrossLives(lives.data)}
          viewers={lives.data.reduce((total, live) => total + live.viewers, 0)}
          peakViewers={Math.max(...lives.data.map((live) => live.peakViewers))}
        />
      ) : null}

      {formError ? (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      ) : null}

      {lives.isError ? <ErrorState title="We couldn't load your lives" description={readErrorMessageForDisplay(lives.error)} onRetry={() => void lives.refetch()} /> : null}

      <ul className={styles.list}>
        {(lives.data ?? []).map((live) => (
          <LiveRow key={live.id} live={live} />
        ))}
      </ul>

      {lives.data?.length === 0 ? <EmptyState title="No lives yet" description="Give your first live a title above and pick a category. You'll get a stream key for OBS, or go live from the Zudomart app." /> : null}
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
          {LIVE_CATEGORY_LABELS[live.category]}
          {" · "}
          {formatCountWithThousandsSuffix(live.earnings.coins)} coins
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
