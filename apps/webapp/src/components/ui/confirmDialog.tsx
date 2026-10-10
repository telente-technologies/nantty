"use client";

import type { ReactNode } from "react";
import { create } from "zustand";

import { Dialog, type DialogTone } from "./dialog";
import { AlertIcon, ShieldIcon, SuccessIcon, TrashIcon } from "./icons";

export interface ConfirmationRequest {
  readonly title: string;
  readonly description?: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly tone?: DialogTone;
  readonly icon?: ReactNode;
}

interface PendingConfirmation extends ConfirmationRequest {
  readonly resolve: (confirmed: boolean) => void;
}

interface ConfirmationStore {
  readonly pending: PendingConfirmation | null;
  readonly isOpen: boolean;
  readonly open: (request: PendingConfirmation) => void;
  readonly settle: (confirmed: boolean) => void;
}

const useConfirmationStore = create<ConfirmationStore>((set, get) => ({
  pending: null,
  isOpen: false,
  open: (request) => {
    get().pending?.resolve(false);
    set({ pending: request, isOpen: true });
  },
  settle: (confirmed) => {
    get().pending?.resolve(confirmed);
    set({ isOpen: false });
  },
}));

export function requestConfirmation(request: ConfirmationRequest): Promise<boolean> {
  return new Promise((resolve) => useConfirmationStore.getState().open({ ...request, resolve }));
}

function DefaultToneIcon({ tone }: { readonly tone: DialogTone }) {
  if (tone === "danger") return <TrashIcon size={24} />;
  if (tone === "caution") return <AlertIcon size={24} />;
  if (tone === "success") return <SuccessIcon size={24} />;
  if (tone === "brand") return <ShieldIcon size={24} />;
  return null;
}

export function ConfirmDialogHost() {
  const { pending, isOpen, settle } = useConfirmationStore();
  if (!pending) return null;
  const tone = pending.tone ?? "neutral";
  const icon = pending.icon ?? <DefaultToneIcon tone={tone} />;
  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => settle(false)}
      role="alertdialog"
      title={pending.title}
      description={pending.description}
      tone={tone}
      icon={tone === "neutral" && !pending.icon ? undefined : icon}
      actions={[
        { label: pending.confirmLabel, variant: tone === "danger" ? "danger" : "primary", onClick: () => settle(true) },
        { label: pending.cancelLabel ?? "Cancel", variant: "secondary", onClick: () => settle(false), isInitialFocus: tone === "danger" },
      ]}
    />
  );
}
