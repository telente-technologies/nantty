"use client";

import type { ReactNode } from "react";

import { Dialog, type DialogIntent } from "@nantty/web-kit";

interface OverlayDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly layout?: "modal" | "sidePanel";
  readonly width?: number;
  readonly intent?: DialogIntent;
  readonly tone?: "neutral" | "brand" | "danger" | "success" | "caution";
  readonly isBusy?: boolean;
  readonly errorMessage?: string | null;
}

export function OverlayDialog({ isOpen, onClose, title, description, children, footer, layout = "modal", width, intent, tone, isBusy = false, errorMessage }: OverlayDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      layout={layout === "sidePanel" ? "sidePanel" : "centered"}
      size="medium"
      width={layout === "sidePanel" ? undefined : width}
      intent={intent}
      tone={tone}
      busy={isBusy}
      errorMessage={errorMessage}
      footer={footer}
    >
      {children}
    </Dialog>
  );
}
