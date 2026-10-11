import type { Metadata } from "next";

import { StudioEmbedCodeBuilder } from "@/components/embed/embedCodeBuilder";

export const metadata: Metadata = { title: "Embed on your site" };

export default function StudioEmbedPage() {
  return <StudioEmbedCodeBuilder />;
}
