"use client";

import { GlobalErrorScreen, ThemeInitScript } from "@zudomart/web-kit";

import { sellerErrorExperience } from "@/components/errors/errorExperience.provider";

import "./globals.css";

export default function GlobalError({ error, retry }: { readonly error: Error & { readonly digest?: string }; readonly retry: () => void }) {
  return (
    <html lang="en-NG" suppressHydrationWarning>
      <head>
        <ThemeInitScript />
        <title>Something broke | Zudomart</title>
      </head>
      <body>
        <GlobalErrorScreen error={error} retry={retry} config={sellerErrorExperience} />
      </body>
    </html>
  );
}
