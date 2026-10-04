import type { Metadata } from "next";

import { HelpTopicEditor } from "@/components/help/helpTopicEditor";

export const metadata: Metadata = { title: "New help topic" };

export default function NewHelpTopicPage() {
  return <HelpTopicEditor topicId={null} />;
}
