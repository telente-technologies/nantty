"use client";

import { openCookieSettings } from "@nantty/web-kit";

export function CookieSettingsButton({ className }: { readonly className?: string }) {
  return (
    <button type="button" className={className} onClick={openCookieSettings}>
      Cookie settings
    </button>
  );
}
