"use client";

import { useEffect, useState } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, PageHeader } from "@/components/ui/surfaces";
import { NanttyIcon } from "@/components/ui/nanttyIcon";
import { accountsApi } from "@/services/accountsApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { ActivityEntry, ActivityObjectType } from "@/types/tools.type";
import { formatDateAndTime, formatRelativeTimeFromNow } from "@/utils/dateRange.util";

import styles from "./activityLogPage.module.css";

const objectTypeOptions: readonly { value: ActivityObjectType | ""; label: string }[] = [
  { value: "", label: "Everything" },
  { value: "campaign", label: "Campaigns" },
  { value: "ad_set", label: "Ad sets" },
  { value: "ad", label: "Ads and reviews" },
  { value: "audience", label: "Audiences" },
  { value: "billing", label: "Billing" },
  { value: "member", label: "People" },
  { value: "rule", label: "Rules" },
  { value: "experiment", label: "A/B tests" },
  { value: "conversion_event", label: "Conversion events" },
  { value: "account", label: "Account settings" },
];

function ActivityEntryRow({ entry }: { readonly entry: ActivityEntry }) {
  return (
    <li className={styles.entry}>
      <span className={entry.actor.isSystem ? `${styles.actorMark} ${styles.systemMark}` : styles.actorMark} aria-hidden>
        {entry.actor.isSystem ? <NanttyIcon name="shield24" size={16} /> : entry.actor.name.slice(0, 1).toUpperCase()}
      </span>
      <div className={styles.entryBody}>
        <p className={styles.headline}>
          <strong>{entry.actor.name}</strong>
          {entry.actor.isSystem ? <StatusBadge tone="neutral">Automatic</StatusBadge> : null}
          <span>{entry.summary}</span>
        </p>
        {entry.objectName ? <p className={styles.objectName}>{entry.objectName}</p> : null}
        {entry.changes.some((change) => change.from !== null || change.to !== null) ? (
          <ul className={styles.changes} aria-label="Changes">
            {entry.changes.map((change, index) => (
              <li key={index}>
                {change.field}: {change.from !== null ? <span className={styles.changeFrom}>{change.from}</span> : null} {change.from !== null ? "→" : ""} <strong>{change.to ?? "—"}</strong>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <time className={styles.time} dateTime={entry.createdAt} title={formatDateAndTime(entry.createdAt)}>
        {formatRelativeTimeFromNow(entry.createdAt)}
      </time>
    </li>
  );
}

export function ActivityLogPage() {
  const { accountId } = useAdAccount();
  const [objectType, setObjectType] = useState<ActivityObjectType | "">("");
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  async function loadActivityPage(cursor: string | null, replaceExisting: boolean) {
    setIsLoading(true);
    setErrorMessage(null);
    setLoadError(null);
    try {
      const page = await accountsApi.listActivity(accountId, { objectType, cursor });
      setEntries((current) => (replaceExisting ? [...page.items] : [...current, ...page.items]));
      setNextCursor(page.nextCursor);
    } catch (error) {
      setLoadError(error);
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadActivityPage(null, true);
  }, [accountId, objectType, reloadCounter]);

  return (
    <>
      <PageHeader title="Activity log" description="Every change to campaigns, reviews, billing and people on this ad account." />
      <div className={styles.filters}>
        <SelectField label="Show" value={objectType} onValueChange={setObjectType} options={objectTypeOptions} />
      </div>
      {errorMessage ? <ErrorState error={loadError} message={errorMessage} onRetry={() => setReloadCounter((current) => current + 1)} /> : null}
      <Card padded={false}>
        {isLoading && entries.length === 0 ? <LoadingBlock /> : null}
        {!isLoading && entries.length === 0 && !errorMessage ? <EmptyState iconName="textIndent24" title="Nothing here yet" description="Changes appear here as soon as anyone on the account makes them." /> : null}
        <ul className={styles.timeline}>
          {entries.map((entry) => (
            <ActivityEntryRow key={entry.id} entry={entry} />
          ))}
        </ul>
        {nextCursor ? (
          <div className={styles.footer}>
            <Button size="small" isLoading={isLoading} onClick={() => loadActivityPage(nextCursor, false)}>
              Load more
            </Button>
          </div>
        ) : null}
      </Card>
    </>
  );
}
