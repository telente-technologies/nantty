"use client";

import type { ReactNode } from "react";

import { Dialog, type DialogIntent, type DialogTone } from "./dialog";

interface ModalDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly description?: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly icon?: ReactNode;
  readonly intent?: DialogIntent;
  readonly tone?: DialogTone;
  readonly busy?: boolean;
  readonly errorMessage?: string | null;
}

export function ModalDialog({ isOpen, title, description, onClose, children, footer, icon, intent, tone, busy, errorMessage }: ModalDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title} description={description} layout="sheet" size="medium" footer={footer} icon={icon} intent={intent} tone={tone} busy={busy} errorMessage={errorMessage}>
      {children}
    </Dialog>
  );
}
