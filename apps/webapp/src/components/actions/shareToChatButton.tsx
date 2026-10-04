"use client";

import { useState, type ReactNode } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { ShareIcon } from "@/components/ui/icons";
import type { ShareReferenceKind } from "@/services/webActions.service";

import { ShareToChatDialog } from "./shareToChatDialog";

interface ShareToChatButtonProps {
  readonly kind: ShareReferenceKind;
  readonly referenceId: string;
  readonly className?: string;
  readonly label?: string;
  readonly iconSize?: number;
  readonly iconOnly?: boolean;
  readonly icon?: ReactNode;
}

export function ShareToChatButton({ kind, referenceId, className, label = "Share", iconSize = 18, iconOnly = false, icon }: ShareToChatButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} aria-label={iconOnly ? "Send in chat" : undefined} onClick={() => requireAuthThen(() => setIsOpen(true), "Sign in to send this in a chat.")}>
        {icon ?? <ShareIcon size={iconSize} />}
        {iconOnly ? null : <span>{label}</span>}
      </button>
      <ShareToChatDialog isOpen={isOpen} onClose={() => setIsOpen(false)} kind={kind} referenceId={referenceId} />
    </>
  );
}
