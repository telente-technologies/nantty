"use client";

import { isBrowserStorageAvailable } from "@nantty/web-kit";
import { useEffect, useState } from "react";

import { ErrorState } from "@/components/ui/feedback";

export function CookiesRequiredNotice() {
  const [isBlocked, setIsBlocked] = useState(false);
  useEffect(() => setIsBlocked(!isBrowserStorageAvailable()), []);
  return isBlocked ? <ErrorState variant="inline" kind="storageDisabled" /> : null;
}
