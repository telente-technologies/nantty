"use client";

import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import { useSession } from "@/components/providers/sessionProvider";
import { SelectField, TextField } from "@/components/ui/field";
import { LIVE_CATEGORY_OPTIONS } from "@/constants/liveCategories.constant";
import { livesService } from "@/services/lives.service";
import type { LiveCategory, StoreOption, User } from "@/types";
import { readLiveErrorMessage } from "@/utils/liveStoreErrors.util";

import styles from "./liveDetails.module.css";

export const NO_STORE = "";

export interface LiveDetailsValue {
  readonly title: string;
  readonly category: LiveCategory;
  readonly storeId: string | null;
}

const pickDefaultStore = (stores: readonly StoreOption[], viewer: User | null): string =>
  (stores.find((store) => store.id === viewer?.storeId) ?? stores.find((store) => store.isCurrent) ?? stores[0])?.id ?? NO_STORE;

export function useLiveDetails(value: LiveDetailsValue) {
  const { viewer } = useSession();
  const stores = useQuery({ queryKey: ["my-stores"], queryFn: () => livesService.listMyStores(), enabled: viewer !== null });
  const storeOptions = stores.data ?? [];
  const storeId = value.storeId ?? pickDefaultStore(storeOptions, viewer);
  const category: LiveCategory = value.category === "shopping" && storeId === NO_STORE ? "justChatting" : value.category;
  return { stores, storeOptions, storeId, category, title: value.title.trim() || "Untitled live" };
}

export function LiveDetailsFields({ value, onChange, titleError }: { readonly value: LiveDetailsValue; readonly onChange: (next: LiveDetailsValue) => void; readonly titleError?: string | null }) {
  const groupId = useId();
  const details = useLiveDetails(value);
  const categoryOptions = LIVE_CATEGORY_OPTIONS.filter((option) => option.value !== "shopping" || details.storeId !== NO_STORE);

  return (
    <div className={styles.fields}>
      <TextField label="Title" name="title" placeholder="Give this live a title" maxLength={140} value={value.title} error={titleError} onChange={(event) => onChange({ ...value, title: event.target.value })} />
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Category</legend>
        <div className={styles.categoryRow}>
          {categoryOptions.map((option) => (
            <label key={option.value} className={styles.categoryChip}>
              <input type="radio" name={`${groupId}-category`} value={option.value} checked={details.category === option.value} onChange={() => onChange({ ...value, category: option.value })} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {details.storeOptions.length > 0 ? (
        <SelectField label="Stream for" hint="Only lives started for a store can show and pin that store's products." value={details.storeId} onChange={(event) => onChange({ ...value, storeId: event.target.value })}>
          {details.storeOptions.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
          <option value={NO_STORE}>Just me (no products)</option>
        </SelectField>
      ) : null}
      {details.stores.isError ? <p className={styles.error} role="alert">{readLiveErrorMessage(details.stores.error)}</p> : null}
    </div>
  );
}
