import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./actionLink.module.css";

type ActionLinkAppearance = "primary" | "secondary" | "onDark" | "ghost";

interface ActionLinkProps {
  readonly href: string;
  readonly children: ReactNode;
  readonly appearance?: ActionLinkAppearance;
  readonly className?: string;
  readonly opensInNewTab?: boolean;
  readonly disabled?: boolean;
}

export function ActionLinkStyledAsButton({ href, children, appearance = "primary", className, opensInNewTab = false, disabled = false }: ActionLinkProps) {
  const combinedClassName = [styles.actionLink, styles[appearance], className].filter(Boolean).join(" ");
  if (disabled) {
    return (
      <button type="button" className={combinedClassName} disabled aria-label="Open the web app — available at launch" title="Available at launch" data-prelaunch-locked="true">
        <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none">
          <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.25 7V4.75a2.75 2.75 0 0 1 5.5 0V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {children}
      </button>
    );
  }
  if (opensInNewTab) {
    return (
      <a href={href} className={combinedClassName} target="_blank" rel="noopener noreferrer">
        {children}
        <span className="visuallyHidden"> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <Link href={href} className={combinedClassName}>
      {children}
    </Link>
  );
}
