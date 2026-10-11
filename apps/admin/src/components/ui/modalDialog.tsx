"use client";

import type { ReactNode } from "react";

import { Dialog, type DialogIntent } from "@zudomart/web-kit";

interface ModalDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly description?: ReactNode;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly width?: "narrow" | "medium" | "wide";
  readonly tone?: "default" | "danger" | "secure";
  readonly intent?: DialogIntent;
  readonly isDismissible?: boolean;
  readonly isBusy?: boolean;
  readonly errorMessage?: string | null;
}

const sizeByWidth = { narrow: "small", medium: "medium", wide: "large" } as const;
const toneByTone = { default: undefined, danger: "danger", secure: "brand" } as const;

export function ModalDialog({ isOpen, title, description, onClose, children, footer, width = "medium", tone = "default", intent, isDismissible = true, isBusy = false, errorMessage }: ModalDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      size={sizeByWidth[width]}
      tone={toneByTone[tone]}
      intent={intent}
      dismissible={isDismissible}
      busy={isBusy}
      errorMessage={errorMessage}
      footer={footer}
    >
      {children}
    </Dialog>
  );
}
