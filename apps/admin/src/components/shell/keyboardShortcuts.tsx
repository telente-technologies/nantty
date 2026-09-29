"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAdminSession } from "@/components/session/adminSessionProvider";
import { ModalDialog } from "@/components/ui/modalDialog";
import { KeyboardKey } from "@/components/ui/surfaces";
import { navigationGroups } from "@/config/navigation.config";
import { isTypingInEditableField, useKeyboardShortcut } from "@/hooks/useKeyboardShortcut.hook";
import { doesAdminMeetPageRequirement } from "@/utils/adminAccess.util";

import styles from "./keyboardShortcuts.module.css";

export const globalSearchInputId = "global-user-search";

export function KeyboardShortcuts() {
  const router = useRouter();
  const { admin } = useAdminSession();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const isAwaitingGoKeyRef = useRef(false);
  const goItems = navigationGroups.flatMap((group) => group.items).filter((item) => item.goShortcutKey && doesAdminMeetPageRequirement(admin, item.requirement));

  useKeyboardShortcut("?", () => setIsHelpOpen(true));
  useKeyboardShortcut("/", (event) => {
    const searchInput = document.getElementById(globalSearchInputId);
    if (searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
  });

  useEffect(() => {
    let resetTimer: number | undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTypingInEditableField(event.target) || document.querySelector("dialog[open]")) return;
      if (isAwaitingGoKeyRef.current) {
        isAwaitingGoKeyRef.current = false;
        const target = goItems.find((item) => item.goShortcutKey === event.key);
        if (target) {
          event.preventDefault();
          router.push(target.href);
        }
        return;
      }
      if (event.key === "g") {
        isAwaitingGoKeyRef.current = true;
        window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(() => (isAwaitingGoKeyRef.current = false), 1200);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(resetTimer);
    };
  }, [goItems, router]);

  return (
    <ModalDialog isOpen={isHelpOpen} title="Keyboard shortcuts" onClose={() => setIsHelpOpen(false)} width="narrow">
      <dl className={styles.list}>
        <div><dt><KeyboardKey>/</KeyboardKey></dt><dd>Search users</dd></div>
        <div><dt><KeyboardKey>j</KeyboardKey> <KeyboardKey>k</KeyboardKey></dt><dd>Move between table rows</dd></div>
        <div><dt><KeyboardKey>Enter</KeyboardKey></dt><dd>Open the focused row</dd></div>
        <div><dt><KeyboardKey>Esc</KeyboardKey></dt><dd>Close a panel or dialog</dd></div>
        {goItems.map((item) => (
          <div key={item.href}>
            <dt><KeyboardKey>g</KeyboardKey> <KeyboardKey>{item.goShortcutKey}</KeyboardKey></dt>
            <dd>Go to {item.label.toLowerCase()}</dd>
          </div>
        ))}
        <div><dt><KeyboardKey>?</KeyboardKey></dt><dd>Show this list</dd></div>
      </dl>
    </ModalDialog>
  );
}
