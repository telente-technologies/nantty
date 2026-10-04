"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { liveSafetyService } from "@/services/liveSafety.service";
import type { GuestReportReason, ID, StageGuest } from "@/types";

import styles from "./liveSafety.module.css";

const GUEST_REPORT_REASONS: readonly { readonly value: GuestReportReason; readonly label: string }[] = [
  { value: "child_safety", label: "Child safety (urgent)" },
  { value: "self_harm", label: "Self-harm or suicide (urgent)" },
  { value: "violence", label: "Violence or dangerous acts (urgent)" },
  { value: "sexual_content", label: "Nudity or sexual content" },
  { value: "hate", label: "Hate" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "scam", label: "Scam or fraud" },
  { value: "intellectual_property", label: "Copyright or intellectual property" },
  { value: "other", label: "Something else" },
];

function GuestReportForm({ liveId, guest, onDone }: { readonly liveId: ID; readonly guest: StageGuest; readonly onDone: () => void }) {
  const [reason, setReason] = useState<GuestReportReason | "">("");
  const [details, setDetails] = useState("");
  const report = useMutation({ mutationFn: () => liveSafetyService.reportGuest(liveId, guest.user.id, reason as GuestReportReason, details.trim()) });
  if (report.isSuccess) {
    return (
      <p className={styles.muted}>
        Report sent. Our safety team will review @{guest.user.username}. You can also remove them from the stage.{" "}
        <button type="button" className={styles.linkButton} onClick={onDone}>
          Close
        </button>
      </p>
    );
  }
  return (
    <form
      className={styles.reportForm}
      onSubmit={(event) => {
        event.preventDefault();
        if (reason) report.mutate();
      }}
    >
      <label className={styles.muted} htmlFor={`guest-reason-${guest.slotId}`}>
        Why are you reporting @{guest.user.username}?
      </label>
      <select id={`guest-reason-${guest.slotId}`} className={styles.select} value={reason} onChange={(event) => setReason(event.target.value as GuestReportReason)}>
        <option value="">Choose a reason</option>
        {GUEST_REPORT_REASONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {reason === "self_harm" ? (
        <p className={styles.notice}>If someone is in immediate danger, contact local emergency services now. Free helplines are listed at findahelpline.com.</p>
      ) : null}
      <textarea className={styles.textarea} aria-label="Details (optional)" placeholder="Details (optional)" maxLength={400} value={details} onChange={(event) => setDetails(event.target.value)} />
      {report.isError ? <p className={styles.error}>{report.error instanceof Error ? report.error.message : "Couldn't send the report."}</p> : null}
      <div className={styles.formActions}>
        <Button type="button" variant="secondary" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" size="sm" disabled={!reason} busy={report.isPending}>
          Send report
        </Button>
      </div>
    </form>
  );
}

export function StageGuestsPanel({ liveId, isActive }: { readonly liveId: ID; readonly isActive: boolean }) {
  const guests = useQuery({ queryKey: ["live-stage-guests", liveId], queryFn: () => liveSafetyService.listStageGuests(liveId), enabled: isActive, refetchInterval: 10_000 });
  const [reportingSlotId, setReportingSlotId] = useState<string | null>(null);
  if (!isActive) return null;
  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Guests on stage</h2>
      {(guests.data?.length ?? 0) === 0 ? <p className={styles.muted}>No guests on stage right now.</p> : null}
      <ul className={styles.guestList}>
        {guests.data?.map((guest) => (
          <li key={guest.slotId} className={styles.guestItem}>
            <div className={styles.guestRow}>
              <span>
                <strong>{guest.user.name || guest.user.username}</strong> <span className={styles.muted}>@{guest.user.username}</span>
              </span>
              {reportingSlotId === guest.slotId ? null : (
                <Button variant="secondary" size="sm" onClick={() => setReportingSlotId(guest.slotId)}>
                  Report guest
                </Button>
              )}
            </div>
            {reportingSlotId === guest.slotId ? <GuestReportForm liveId={liveId} guest={guest} onDone={() => setReportingSlotId(null)} /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
