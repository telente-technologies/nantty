"use client";

import { useState } from "react";

import { TextField } from "@/components/ui/formFields";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { NanttyIcon } from "@/components/ui/nanttyIcon";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.hook";
import { campaignsApi } from "@/services/campaignsApi.service";
import type { ContentSource } from "@/types/creative.type";
import { formatCompactCount } from "@/utils/numberFormatting.util";
import { formatDateAndTime } from "@/utils/dateRange.util";
import { formatMoneyForDisplay } from "@/utils/money.util";

import styles from "./creativeEditor.module.css";

interface ContentSourcePickerProps {
  readonly accountId: string;
  readonly sourceType: ContentSource["type"];
  readonly selectedSourceId: string | null;
  readonly onSourceSelected: (source: ContentSource) => void;
}

const pluralSourceNames: Record<ContentSource["type"], string> = { post: "posts", clip: "reels", product: "products", store: "stores", live: "live sessions" };

function describeSourceEngagement(source: ContentSource): string {
  if (source.live) return source.live.status === "live" ? `Live now · ${formatCompactCount(source.live.viewerCount)} watching` : `Scheduled · ${formatDateAndTime(source.live.startsAt)}`;
  if (source.product) return formatMoneyForDisplay(source.product.price);
  if (source.type === "store") return "Your store";
  return `${formatCompactCount(source.engagement.views)} views · ${formatCompactCount(source.engagement.likes)} likes`;
}

export function ContentSourcePicker({ accountId, sourceType, selectedSourceId, onSourceSelected }: ContentSourcePickerProps) {
  const [searchText, setSearchText] = useState("");
  const debouncedSearchText = useDebouncedValue(searchText, 300);
  const sourcesQuery = useAdsQuery(() => campaignsApi.listContentSources(accountId, sourceType, debouncedSearchText), `${accountId}-${sourceType}-${debouncedSearchText}`);
  const sources = sourcesQuery.data?.items ?? [];
  return (
    <div className={styles.picker}>
      <TextField label={`Search your ${pluralSourceNames[sourceType]}`} hideLabel placeholder={`Search ${pluralSourceNames[sourceType]}`} value={searchText} onValueChange={setSearchText} type="search" />
      {sourcesQuery.errorMessage ? <ErrorState error={sourcesQuery.error} message={sourcesQuery.errorMessage} onRetry={sourcesQuery.reload} /> : null}
      {sourcesQuery.isLoading && sources.length === 0 ? <LoadingBlock height={120} label="Loading content" /> : null}
      {!sourcesQuery.isLoading && sources.length === 0 && !sourcesQuery.errorMessage ? <p className={styles.muted}>Nothing to promote here yet. Publish from the Nantty app first, or upload new media.</p> : null}
      <ul className={styles.sourceGrid} role="radiogroup" aria-label={`Choose a ${sourceType}`}>
        {sources.map((source) => {
          const thumbnail = source.media[0];
          const thumbnailUrl = thumbnail?.kind === "video" ? thumbnail.posterUrl : thumbnail?.url;
          const isSelected = source.id === selectedSourceId;
          return (
            <li key={source.id}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={!source.eligible}
                title={source.ineligibleReason ?? undefined}
                className={isSelected ? `${styles.sourceCard} ${styles.sourceCardSelected}` : styles.sourceCard}
                onClick={() => onSourceSelected(source)}
              >
                <span className={styles.sourceThumb}>
                  {thumbnailUrl ? <img src={thumbnailUrl} alt="" /> : <NanttyIcon name="imageSquare24" size={20} />}
                  {thumbnail?.kind === "video" ? <NanttyIcon name="play24" size={16} className={styles.sourcePlay} /> : null}
                </span>
                <span className={styles.sourceText}>
                  <span className={styles.sourceTitle}>{source.title}</span>
                  <span className={styles.sourceMeta}>{source.eligible ? describeSourceEngagement(source) : source.ineligibleReason}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
