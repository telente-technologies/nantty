import { StatusBadge } from "@/components/ui/statusBadge";
import type { VersionedRecord } from "@/types/platformConfiguration.type";
import { formatDateTime, formatRelativeTimeFromNow } from "@/utils/formatting.util";

import styles from "./versionedEditor.module.css";

export function VersionMetaLine({ record, isDirty = false }: { readonly record: VersionedRecord<unknown>; readonly isDirty?: boolean }) {
  return (
    <p className={styles.metaLine}>
      <span className={styles.versionNumber}>v{record.version}</span>
      <span>
        {record.updatedBy.name} · <time dateTime={record.updatedAt} title={formatDateTime(record.updatedAt)}>{formatRelativeTimeFromNow(record.updatedAt)}</time>
      </span>
      <span className={styles.reason} title={record.changeReason}>
        “{record.changeReason}”
      </span>
      {isDirty ? <StatusBadge label="Unsaved changes" tone="caution" /> : null}
    </p>
  );
}
