import type { Metadata } from "next";

import { ChatIcon } from "@/components/ui/icons";

import styles from "./chatsSplit.module.css";

export const metadata: Metadata = { title: "Messages" };

export default function ChatsIndexPage() {
  return (
    <div className={styles.placeholder}>
      <span className={styles.placeholderIcon} aria-hidden="true">
        <ChatIcon size={28} />
      </span>
      <h2 className={styles.placeholderTitle}>Pick a conversation</h2>
      <p className={styles.placeholderText}>Choose a chat on the left, or message a seller from any product page.</p>
    </div>
  );
}
