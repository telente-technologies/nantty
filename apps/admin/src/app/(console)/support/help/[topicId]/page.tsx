import type { Metadata } from "next";

import { HelpTopicEditor } from "@/components/help/helpTopicEditor";

export const metadata: Metadata = { title: "Help topic" };

export default async function HelpTopicPage({ params }: { readonly params: Promise<{ readonly topicId: string }> }) {
  const { topicId } = await params;
  return <HelpTopicEditor topicId={decodeURIComponent(topicId)} />;
}
