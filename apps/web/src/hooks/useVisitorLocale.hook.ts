"use client";

import { useEffect, useState } from "react";

import { fetchVisitorLocaleFromApi } from "@/lib/visitorLocale.service";
import type { VisitorLocale } from "@/types/visitorLocale.types";

let sharedVisitorLocaleRequest: Promise<VisitorLocale> | null = null;

function requestVisitorLocaleOncePerPageLoad(): Promise<VisitorLocale> {
  sharedVisitorLocaleRequest ??= fetchVisitorLocaleFromApi();
  return sharedVisitorLocaleRequest;
}

export function useVisitorLocaleFromApi(): VisitorLocale | null {
  const [visitorLocale, setVisitorLocale] = useState<VisitorLocale | null>(null);

  useEffect(() => {
    // A static marketing artifact must not make request-time calls to the app
    // API. Keep the shared server-rendered app behavior unchanged.
    if (process.env.NANTTY_CLOUDFLARE_STATIC_EXPORT === "1") return;

    let isStillMounted = true;
    void requestVisitorLocaleOncePerPageLoad().then((resolvedLocale) => {
      if (isStillMounted) setVisitorLocale(resolvedLocale);
    });
    return () => {
      isStillMounted = false;
    };
  }, []);

  return visitorLocale;
}
