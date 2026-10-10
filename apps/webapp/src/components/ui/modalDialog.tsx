"use client";

import type { ReactNode } from "react";

import { Dialog, type DialogTone } from "./dialog";

interface ModalDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly description?: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly icon?: ReactNode;
  readonly tone?: DialogTone;
}

export function ModalDialog({ isOpen, title, description, onClose, children, footer, icon, tone = "neutral" }: ModalDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title} description={description} layout="sheet" size="medium" showCloseButton footer={footer} icon={icon} tone={tone}>
      {children}
    </Dialog>
  );
}
