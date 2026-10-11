"use client";

import { useSyncExternalStore } from "react";

import { confirmationStore, type ConfirmationSnapshot, type ConfirmationStore } from "./confirmation.store";
import { Dialog, resolveDialogTone } from "./dialog";

export function ConfirmDialogView({ snapshot, store }: { readonly snapshot: ConfirmationSnapshot; readonly store: ConfirmationStore }) {
  const { pending, isOpen, isSubmitting, errorMessage } = snapshot;
  if (!pending) return null;
  const intent = pending.intent ?? (pending.tone === "danger" && !pending.icon ? "danger" : undefined);
  const isDestructive = resolveDialogTone(pending.tone, intent) === "danger";
  return (
    <Dialog
      key={pending.id}
      isOpen={isOpen}
      onClose={() => store.cancel()}
      role="alertdialog"
      title={pending.title}
      description={pending.description}
      intent={intent}
      tone={pending.tone}
      icon={pending.icon}
      errorMessage={errorMessage}
      actions={[
        { label: pending.confirmLabel, variant: isDestructive ? "danger" : "primary", busy: isSubmitting, onClick: () => void store.confirm() },
        { label: pending.cancelLabel ?? "Cancel", variant: "secondary", onClick: () => store.cancel(), isInitialFocus: isDestructive },
      ]}
    />
  );
}

export function ConfirmDialogHost() {
  const snapshot = useSyncExternalStore(confirmationStore.subscribe, confirmationStore.getSnapshot, confirmationStore.getServerSnapshot);
  return <ConfirmDialogView snapshot={snapshot} store={confirmationStore} />;
}
