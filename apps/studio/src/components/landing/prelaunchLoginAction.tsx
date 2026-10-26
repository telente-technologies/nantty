"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface PrelaunchLoginActionProps {
  readonly className?: string;
  readonly children: ReactNode;
  readonly label?: string;
}

export function PrelaunchLoginAction({ className, children, label = "Sign in" }: PrelaunchLoginActionProps) {
  if (process.env.NEXT_PUBLIC_NANTTY_STATIC_PRELAUNCH !== "1") {
    return <Link href="/login" className={className}>{children}</Link>;
  }

  return (
    <button type="button" className={className} disabled aria-label={`${label} — locked until launch`} title="Available at launch" data-prelaunch-locked="true">
      <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none">
        <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.25 7V4.75a2.75 0 0 1 5.5 0V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {children}
    </button>
  );
}
