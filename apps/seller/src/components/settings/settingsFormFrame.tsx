"use client";

import type { FormEvent, ReactNode } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { FormErrorSummary } from "@/components/ui/formFields";
import { Panel } from "@/components/ui/panel";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { StoreSettings } from "@/types/store.type";

import styles from "./settings.module.css";

export function useCanEditStoreSettings(): boolean {
  return useSellerSession().can("settings:manage");
}

export function StoreSettingsLoadedGate({ children }: { readonly children: (settings: StoreSettings) => ReactNode }) {
  const { settings } = useStoreContext();
  if (!settings) return <LoadingBlock label="Loading settings" />;
  return <>{children(settings)}</>;
}

export function SettingsFormFrame({ title, description, errorMessages, isSaving, onSubmit, children, submitLabel = "Save changes" }: {
  readonly title: string;
  readonly description?: ReactNode;
  readonly errorMessages: readonly string[];
  readonly isSaving: boolean;
  readonly onSubmit: () => void;
  readonly children: ReactNode;
  readonly submitLabel?: string;
}) {
  const canEdit = useCanEditStoreSettings();
  function submitSettingsForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canEdit) onSubmit();
  }
  return (
    <form onSubmit={submitSettingsForm} noValidate>
      <Panel title={title} description={description} actions={canEdit ? <Button type="submit" variant="primary" isBusy={isSaving}>{submitLabel}</Button> : null}>
        <div className={styles.formStack}>
          {canEdit ? null : <Callout tone="info">You can view these settings. Only the owner and managers can change them.</Callout>}
          <FormErrorSummary messages={errorMessages} />
          <fieldset className={styles.fieldset} disabled={!canEdit || isSaving}>
            {children}
          </fieldset>
        </div>
      </Panel>
    </form>
  );
}
