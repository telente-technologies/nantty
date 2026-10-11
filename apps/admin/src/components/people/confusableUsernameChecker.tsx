"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ErrorBlock } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, KeyValueList } from "@/components/ui/surfaces";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { previewUsernameConfusables } from "@/services/peopleApi.service";
import { humanizeConstantName } from "@/utils/formatting.util";

import styles from "./peopleWorkspace.module.css";

export function ConfusableUsernameChecker() {
  const [candidate, setCandidate] = useState("");
  const [debouncedCandidate, setDebouncedCandidate] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedCandidate(candidate.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [candidate]);

  const { data: preview, errorMessage, error: queryError } = useAdminQuery((signal) => previewUsernameConfusables(debouncedCandidate, signal), debouncedCandidate, debouncedCandidate.length > 0);
  const isBlocked = preview ? preview.collisions.length > 0 || preview.takenByUserId !== null || preview.isWithheld : false;

  return (
    <Card title="Confusable preview">
      <div className={styles.stack}>
        <TextField label="Try a username" placeholder="e.g. zud0mart_supp0rt or dаngote (Cyrillic а)" value={candidate} onChange={(event) => setCandidate(event.target.value)} autoComplete="off" spellCheck={false} hint="Shows how the name normalizes and what it collides with." />
        {errorMessage && debouncedCandidate ? <ErrorBlock error={queryError} message={errorMessage} /> : null}
        {preview && debouncedCandidate ? (
          <>
            <StatusBadge tone={isBlocked ? "danger" : "success"} label={isBlocked ? "Would be blocked" : "Available"} />
            <KeyValueList
              columns={2}
              items={[
                { label: "Normalized", value: preview.normalized, isMono: true },
                { label: "Skeleton", value: preview.skeleton, isMono: true },
                { label: "Looks like existing user", value: preview.takenByUserId ? <Link href={`/users/${preview.takenByUserId}`}>@{preview.takenByUsername}</Link> : "No" },
                { label: "Currently withheld", value: preview.isWithheld ? "Yes" : "No" },
              ]}
            />
            {preview.collisions.length > 0 ? (
              <ul className={styles.list}>
                {preview.collisions.map((collision) => (
                  <li key={collision.entryId} className={styles.listItem}>
                    <span className="mono">{collision.value}</span>
                    <span className={styles.row}>
                      <StatusBadge label={`Matched by ${humanizeConstantName(collision.matchedBy).toLowerCase()}`} tone="caution" hasDot={false} />
                      <StatusBadge label={humanizeConstantName(collision.category)} tone="neutral" hasDot={false} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}
