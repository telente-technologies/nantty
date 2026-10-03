import type { Metadata } from "next";

import { ChatReportsWorkspace } from "@/components/trust/chatReportsWorkspace";

export const metadata: Metadata = { title: "Chat reports" };

export default function ModerationChatReportsPage() {
  return <ChatReportsWorkspace />;
}
