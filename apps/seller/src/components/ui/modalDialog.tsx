"use client";

import type { ReactNode } from "react";

import { Dialog, type DialogIntent } from "@nantty/web-kit";

interface ModalDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly description?: ReactNode;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly width?: "small" | "medium" | "large";
  readonly intent?: DialogIntent;
  readonly tone?: "neutral" | "brand" | "danger" | "success" | "caution";
  readonly isDismissible?: boolean;
  readonly isBusy?: boolean;
  readonly errorMessage?: string | null;
}

export function ModalDialog({ isOpen, title, description, onClose, children, footer, width = "medium", intent, tone, isDismissible = true, isBusy = false, errorMessage }: ModalDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title} description={description} size={width} intent={intent} tone={tone} dismissible={isDismissible} busy={isBusy} errorMessage={errorMessage} footer={footer}>
      {children}
    </Dialog>
  );
}
