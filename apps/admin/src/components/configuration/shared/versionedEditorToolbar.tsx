import { Button } from "@/components/ui/button";
import type { VersionedRecord } from "@/types/platformConfiguration.type";

import styles from "./versionedEditor.module.css";
import { VersionMetaLine } from "./versionMetaLine";

interface VersionedEditorToolbarProps {
  readonly record: VersionedRecord<unknown>;
  readonly isDirty: boolean;
  readonly canWrite: boolean;
  readonly onDiscard: () => void;
  readonly onRequestSave: () => void;
  readonly onOpenHistory: () => void;
}

export function VersionedEditorToolbar({ record, isDirty, canWrite, onDiscard, onRequestSave, onOpenHistory }: VersionedEditorToolbarProps) {
  return (
    <div className={isDirty ? `${styles.toolbar} ${styles.toolbarDirty}` : styles.toolbar}>
      <VersionMetaLine record={record} isDirty={isDirty} />
      <div className={styles.toolbarActions}>
        <Button size="small" variant="ghost" iconName="textIndent24" onClick={onOpenHistory}>
          Version history
        </Button>
        {canWrite ? (
          <>
            <Button size="small" variant="ghost" onClick={onDiscard} disabled={!isDirty}>
              Discard
            </Button>
            <Button size="small" variant="primary" iconName="shield24" onClick={onRequestSave} disabled={!isDirty}>
              Review and save
            </Button>
          </>
        ) : (
          <span className={styles.readOnlyNote}>Read only — your permissions don't allow changes here.</span>
        )}
      </div>
    </div>
  );
}
