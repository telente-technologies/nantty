"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";

import { CloseIcon } from "@/components/ui/icons";
import { soundsService } from "@/services/sounds.service";
import type { ClipSound, ID } from "@/types";

import styles from "./composer.module.css";

export function SoundPicker({ selectedSoundId, onChange, hasOwnAudio }: { readonly selectedSoundId: ID | null; readonly onChange: (soundId: ID | null) => void; readonly hasOwnAudio: boolean }) {
  const inputId = useId();
  const [tab, setTab] = useState<"trending" | "saved">("trending");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const sounds = useQuery({
    queryKey: debounced ? ["sounds", "search", debounced] : ["sounds", tab],
    queryFn: () => (debounced ? soundsService.searchSounds(debounced) : tab === "trending" ? soundsService.fetchTrendingSounds() : soundsService.fetchSavedSounds()),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const selected = useQuery({ queryKey: ["sound", selectedSoundId], queryFn: () => soundsService.fetchSoundById(selectedSoundId!), enabled: selectedSoundId !== null, retry: false });
  const usable = (sounds.data ?? []).filter((sound: ClipSound) => sound.allowReuse && sound.status === "available");
  const noSoundLabel = hasOwnAudio ? "Original sound" : "No sound";

  return (
    <div className={styles.picker}>
      <label htmlFor={inputId} className={styles.pickerLabel}>Sound</label>
      {selectedSoundId ? (
        <ul className={styles.chosenList} aria-label="Chosen sound">
          <li className={styles.chosenChip}>
            <span>{selected.data ? (selected.data.isOriginal ? "Original sound" : selected.data.title) : "Sound"}</span>
            <button type="button" aria-label="Remove sound" onClick={() => onChange(null)}><CloseIcon size={12} /></button>
          </li>
        </ul>
      ) : <span className={styles.hint}>{noSoundLabel}</span>}
      <div className={styles.labelChips} role="group" aria-label="Sounds">
        {(["trending", "saved"] as const).map((option) => (
          <button key={option} type="button" className={styles.labelChip} aria-pressed={tab === option && !debounced} onClick={() => { setTab(option); setSearch(""); }}>
            {option === "trending" ? "Trending" : "Saved"}
          </button>
        ))}
      </div>
      <input id={inputId} type="search" className={styles.pickerInput} placeholder="Search sounds" value={search} onChange={(event) => setSearch(event.target.value)} />
      <ul className={styles.pickerResults}>
        {sounds.isError ? <li className={styles.pickerEmpty}>Couldn&apos;t load sounds. Try again.</li> : null}
        {sounds.isSuccess && usable.length === 0 ? <li className={styles.pickerEmpty}>{tab === "saved" && !debounced ? "Sounds you save appear here." : "No sounds found."}</li> : null}
        {usable.slice(0, 12).map((sound) => (
          <li key={sound.id}>
            <button type="button" className={styles.pickerRow} aria-pressed={sound.id === selectedSoundId} onClick={() => onChange(sound.id)}>
              <span className={styles.pickerRowText}>
                <strong>{sound.isOriginal ? "Original sound" : sound.title}</strong>
                <span>@{sound.owner.username} · {sound.usageCount.toLocaleString()} clips</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
