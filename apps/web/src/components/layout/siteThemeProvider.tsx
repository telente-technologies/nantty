"use client";

import type { ReactNode } from "react";

import { ThemeProvider } from "@nantty/web-kit";

export function SiteThemeProvider({ children }: { readonly children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
