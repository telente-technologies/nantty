"use client";

import type { ReactNode } from "react";

import { ThemeProvider } from "@zudomart/web-kit";

export function SiteThemeProvider({ children }: { readonly children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
