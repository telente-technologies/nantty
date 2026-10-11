"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";

import { Avatar, MediaImage } from "@/components/ui/media";
import { CloseIcon } from "@/components/ui/icons";
import { composerService } from "@/services/composer.service";
import type { UserSummary } from "@/types";
import type { ComposerTaggedProduct } from "@/utils/composerDraft.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "./composer.module.css";

export const MAXIMUM_TAGGED_PEOPLE = 40;
export const MAXIMUM_TAGGED_PRODUCTS = 10;

function useDebouncedText(text: string, delayMs = 250) {
  const [debounced, setDebounced] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text), delayMs);
    return () => clearTimeout(timer);
  }, [text, delayMs]);
  return debounced;
}

function ChosenChip({ label, onRemove }: { readonly label: string; readonly onRemove: () => void }) {
  return (
    <li className={styles.chosenChip}>
      <span>{label}</span>
      <button type="button" aria-label={`Remove ${label}`} onClick={onRemove}>
        <CloseIcon size={12} />
      </button>
    </li>
  );
}

export function TagPeoplePicker({ tagged, onChange }: { readonly tagged: readonly UserSummary[]; readonly onChange: (people: readonly UserSummary[]) => void }) {
  const inputId = useId();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedText(search);
  const candidates = useQuery({
    queryKey: ["tagCandidates", debounced],
    queryFn: () => composerService.searchTagCandidates(debounced),
    enabled: debounced.trim().length > 0,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const isFull = tagged.length >= MAXIMUM_TAGGED_PEOPLE;
  return (
    <div className={styles.picker}>
      <label htmlFor={inputId} className={styles.pickerLabel}>Tag people</label>
      <input id={inputId} type="search" className={styles.pickerInput} placeholder="Search for people to tag in this post" value={search} disabled={isFull} onChange={(event) => setSearch(event.target.value)} />
      {tagged.length > 0 ? (
        <ul className={styles.chosenList} aria-label="Tagged people">
          {tagged.map((person) => <ChosenChip key={person.id} label={`@${person.username}`} onRemove={() => onChange(tagged.filter((entry) => entry.id !== person.id))} />)}
        </ul>
      ) : null}
      {search.trim() && candidates.data ? (
        <ul className={styles.pickerResults}>
          {candidates.data.length === 0 ? <li className={styles.pickerEmpty}>No people found.</li> : null}
          {candidates.data.map(({ user, canTag, unavailableReason }) => {
            const isChosen = tagged.some((entry) => entry.id === user.id);
            return (
              <li key={user.id}>
                <button
                  type="button"
                  className={styles.pickerRow}
                  disabled={!canTag || isChosen || isFull}
                  onClick={() => {
                    onChange([...tagged, user]);
                    setSearch("");
                  }}
                >
                  <Avatar name={user.name} src={user.avatarUrl} size="xs" />
                  <span className={styles.pickerRowText}>
                    <strong>{user.name}</strong>
                    <span>@{user.username}</span>
                  </span>
                  {canTag ? null : <span className={styles.pickerNote}>{unavailableReason ?? "Can't be tagged"}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {candidates.isError ? <p className={styles.fieldError} role="alert">We couldn&apos;t search people. Try again.</p> : null}
    </div>
  );
}

export function TagProductsPicker({ products, onChange }: { readonly products: readonly ComposerTaggedProduct[]; readonly onChange: (products: readonly ComposerTaggedProduct[]) => void }) {
  const inputId = useId();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedText(search);
  const results = useQuery({
    queryKey: ["taggableProducts", debounced],
    queryFn: () => composerService.searchTaggableProducts(debounced),
    enabled: debounced.trim().length > 1,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const isFull = products.length >= MAXIMUM_TAGGED_PRODUCTS;
  return (
    <div className={styles.picker}>
      <label htmlFor={inputId} className={styles.pickerLabel}>Tag products</label>
      <input id={inputId} type="search" className={styles.pickerInput} placeholder="Search Mart for products to tag" value={search} disabled={isFull} onChange={(event) => setSearch(event.target.value)} />
      {products.length > 0 ? (
        <ul className={styles.chosenList} aria-label="Tagged products">
          {products.map((product) => <ChosenChip key={product.id} label={product.name} onRemove={() => onChange(products.filter((entry) => entry.id !== product.id))} />)}
        </ul>
      ) : null}
      {search.trim().length > 1 && results.data ? (
        <ul className={styles.pickerResults}>
          {results.data.length === 0 ? <li className={styles.pickerEmpty}>No products found.</li> : null}
          {results.data.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                className={styles.pickerRow}
                disabled={products.some((entry) => entry.id === product.id) || isFull}
                onClick={() => {
                  onChange([...products, { id: product.id, name: product.name, imageUrl: product.imageUrl }]);
                  setSearch("");
                }}
              >
                <span className={styles.productThumb}>{product.imageUrl ? <MediaImage src={product.imageUrl} alt="" sizes="32px" /> : null}</span>
                <span className={styles.pickerRowText}>
                  <strong>{product.name}</strong>
                  <span>{formatMoneyForDisplay(product.price)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {results.isError ? <p className={styles.fieldError} role="alert">We couldn&apos;t search products. Try again.</p> : null}
    </div>
  );
}
