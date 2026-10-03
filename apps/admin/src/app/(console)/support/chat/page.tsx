import type { Metadata } from "next";

import { LiveChatWorkspace } from "@/components/support/liveChatWorkspace";

export const metadata: Metadata = { title: "Live chat" };

export default function LiveChatPage() {
  return <LiveChatWorkspace />;
}
