"use client";

import { GlobalErrorScreen, ThemeInitScript } from "@nantty/web-kit";

import { sellerErrorExperience } from "@/components/errors/errorExperience.provider";

import "./globals.css";

export default function GlobalError({ error, retry }: { readonly error: Error & { readonly digest?: string }; readonly retry: () => void }) {
  return (
    <html lang="en-NG" suppressHydrationWarning>
      <head>
        <ThemeInitScript />
        <title>Something broke | Nantty</title>
      </head>
      <body>
        <GlobalErrorScreen error={error} retry={retry} config={sellerErrorExperience} />
      </body>
    </html>
  );
}
