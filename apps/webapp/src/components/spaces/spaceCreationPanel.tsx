import type { FormEvent } from "react";
import Link from "next/link";

import styles from "./spaces.module.css";

interface SpaceCreationPanelProps {
  readonly viewerSignedIn: boolean;
  readonly creatorPending: boolean;
  readonly creatorError: boolean;
  readonly creatorApproved: boolean;
  readonly onRetryCreatorCheck: () => void;
  readonly title: string;
  readonly onTitleChange: (value: string) => void;
  readonly description: string;
  readonly onDescriptionChange: (value: string) => void;
  readonly schedule: string;
  readonly onScheduleChange: (value: string) => void;
  readonly coinDonationsEnabled: boolean;
  readonly onCoinDonationsChange: (enabled: boolean) => void;
  readonly busy: boolean;
  readonly canRetryAnnouncement: boolean;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function SpaceCreationPanel({
  viewerSignedIn,
  creatorPending,
  creatorError,
  creatorApproved,
  onRetryCreatorCheck,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  schedule,
  onScheduleChange,
  coinDonationsEnabled,
  onCoinDonationsChange,
  busy,
  canRetryAnnouncement,
  onSubmit,
}: SpaceCreationPanelProps) {
  return (
    <>
      <h1>A conversation worth joining</h1>
      <p className={styles.muted}>
        Creators host. Everyone can listen. Start an audio Space now or
        schedule one for later.
      </p>
      {!viewerSignedIn ? (
        <Link href="/login">Sign in to host</Link>
      ) : creatorPending ? (
        <p>Checking creator access…</p>
      ) : creatorError ? (
        <button className={styles.secondary} onClick={onRetryCreatorCheck}>
          Retry creator check
        </button>
      ) : !creatorApproved ? (
        <Link href="/creator/program">Join the Creator Program to host</Link>
      ) : (
        <form className={styles.form} onSubmit={onSubmit}>
          <label>
            Title
            <input
              required
              disabled={busy || canRetryAnnouncement}
              maxLength={80}
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="What are you talking about?"
            />
          </label>
          <label>
            Description (optional)
            <textarea
              maxLength={500}
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="Add a little context"
            />
          </label>
          <label>
            Schedule (optional)
            <input
              type="datetime-local"
              value={schedule}
              onChange={(event) => onScheduleChange(event.target.value)}
            />
          </label>
          <label className={styles.coinSupportChoice}>
            <input
              type="checkbox"
              checked={coinDonationsEnabled}
              onChange={(event) => onCoinDonationsChange(event.target.checked)}
            />
            Allow listeners to support you with coins
          </label>
          <p className={styles.muted}>
            Times use your local timezone. Leave blank to start now. Anyone can
            join this public Space.
          </p>
          <button className={styles.button} disabled={busy || !title.trim()}>
            {busy
              ? "Publishing…"
              : canRetryAnnouncement
                ? "Retry announcement"
                : schedule
                  ? "Schedule Space"
                  : "Start Space"}
          </button>
        </form>
      )}
    </>
  );
}
