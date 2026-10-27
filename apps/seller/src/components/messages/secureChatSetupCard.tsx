"use client";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { IconLabel } from "@/components/ui/nanttyIcon";

import styles from "./messages.module.css";

export function SecureChatSetupCard({ isBusy, errorMessage, onSetUp }: { readonly isBusy: boolean; readonly errorMessage: string | null; readonly onSetUp: () => void }) {
  return (
    <div className={styles.setupCard}>
      <h2><IconLabel name="shieldCheck24" size={22}>Set up secure messages on this browser</IconLabel></h2>
      <p>Customer chats are end-to-end encrypted. Before you can read or reply here, this browser needs its own secure chat key.</p>
      <ul>
        <li>The key is created on this device and stays in this browser. Nantty never sees it, so we can&apos;t read your chats.</li>
        <li>Only the public half is shared, so customers&apos; apps can encrypt messages to you and your team.</li>
        <li>You&apos;ll see messages sent from now on. Older messages were locked to the devices that were set up when they were sent.</li>
        <li>Signing out removes the key from this browser. Use one browser profile per person on shared computers.</li>
      </ul>
      {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
      <Button variant="primary" iconName="lockKey24" isBusy={isBusy} onClick={onSetUp}>Set up secure messages</Button>
    </div>
  );
}
