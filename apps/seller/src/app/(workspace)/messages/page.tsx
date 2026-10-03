import type { Metadata } from "next";

import { MessagesInboxView } from "@/components/messages/messagesInboxView";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: { readonly searchParams: Promise<{ conversation?: string }> }) {
  const { conversation } = await searchParams;
  return <MessagesInboxView initialConversationId={typeof conversation === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(conversation) ? conversation : null} />;
}
