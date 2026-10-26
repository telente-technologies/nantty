"use client";

import { GlobalErrorScreen } from "@nantty/web-kit";

import { adminErrorExperience } from "@/components/errors/errorExperience.provider";

import "./globals.css";

export default function GlobalError({ error, retry }: { readonly error: Error & { readonly digest?: string }; readonly retry: () => void }) {
  return (
    <html lang="en-NG" suppressHydrationWarning>
      <head>
        <title>Something broke | Nantty</title>
      </head>
      <body>
        <GlobalErrorScreen error={error} retry={retry} config={adminErrorExperience} />
      </body>
    </html>
  );
}
