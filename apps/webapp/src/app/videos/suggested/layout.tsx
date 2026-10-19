import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Suggested videos", robots: { index: false } };

export default function SuggestedVideosLayout({ children }: { readonly children: ReactNode }) {
  return children;
}
