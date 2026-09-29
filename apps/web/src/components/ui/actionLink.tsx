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
}

export function ActionLinkStyledAsButton({ href, children, appearance = "primary", className, opensInNewTab = false }: ActionLinkProps) {
  const combinedClassName = [styles.actionLink, styles[appearance], className].filter(Boolean).join(" ");
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
