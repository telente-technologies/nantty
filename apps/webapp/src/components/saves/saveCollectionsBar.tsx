"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import chipStyles from "@/components/ui/filterChips.module.css";
import { PlusIcon } from "@/components/ui/icons";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { savesService } from "@/services/saves.service";
import type { SaveCollection } from "@/types";

import styles from "./saveCollectionsBar.module.css";

interface SaveCollectionsBarProps {
  readonly collections: readonly SaveCollection[];
  readonly activeCollectionId: string | null;
  readonly onSelectCollection: (collectionId: string | null) => void;
}

export function SaveCollectionsBar({ collections, activeCollectionId, onSelectCollection }: SaveCollectionsBarProps) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState("");

  const createMutation = useMutation({
    mutationFn: (name: string) => savesService.createSaveCollection(name),
    onSuccess: (collection) => {
      setIsCreating(false);
      setDraftName("");
      showToast({ text: `Collection "${collection.name}" created` });
      void queryClient.invalidateQueries({ queryKey: ["saves", "collections"] });
    },
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });

  function submitNewCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draftName.trim();
    if (name) createMutation.mutate(name);
  }

  return (
    <div className={styles.bar}>
      <div className={chipStyles.chipRow} role="group" aria-label="Collections">
        <button
          type="button"
          className={[chipStyles.chip, activeCollectionId === null ? chipStyles.chipActive : ""].join(" ")}
          aria-pressed={activeCollectionId === null}
          onClick={() => onSelectCollection(null)}
        >
          All saved
        </button>
        {collections.map((collection) => (
          <button
            key={collection.id}
            type="button"
            className={[chipStyles.chip, activeCollectionId === collection.id ? chipStyles.chipActive : ""].join(" ")}
            aria-pressed={activeCollectionId === collection.id}
            onClick={() => onSelectCollection(collection.id)}
          >
            {collection.name}
            <span className={chipStyles.chipCount}>{collection.itemCount}</span>
          </button>
        ))}
        {isCreating ? null : (
          <button type="button" className={[chipStyles.chip, styles.newChip].join(" ")} onClick={() => setIsCreating(true)}>
            <PlusIcon size={14} /> New collection
          </button>
        )}
      </div>
      {isCreating ? (
        <form className={styles.form} onSubmit={submitNewCollection}>
          <label className="visuallyHidden" htmlFor="new-collection-name">
            Collection name
          </label>
          <input
            id="new-collection-name"
            className={styles.input}
            value={draftName}
            maxLength={40}
            placeholder="Name your collection"
            autoFocus
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setIsCreating(false);
            }}
          />
          <button type="submit" className={styles.createButton} disabled={!draftName.trim() || createMutation.isPending}>
            Create
          </button>
          <button type="button" className={styles.cancelButton} onClick={() => setIsCreating(false)}>
            Cancel
          </button>
        </form>
      ) : null}
    </div>
  );
}
