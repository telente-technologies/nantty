import type { Metadata } from "next";

import { EmbedCodeBuilder } from "@/components/embed/embedCodeBuilder";

export const metadata: Metadata = { title: "Embed on your site" };

export default function StorefrontEmbedPage() {
  return <EmbedCodeBuilder />;
}
