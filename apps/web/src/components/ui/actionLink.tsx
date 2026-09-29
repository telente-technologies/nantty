import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./actionLink.module.css";

type ActionLinkAppearance = "primary" | "secondary" | "onDark" | "ghost";

interface ActionLinkProps {
  readonly href: string;
  readonly children: ReactNode;
  readonly appearance?: ActionLinkAppearance;
  readonly className?: string;
}

export function ActionLinkStyledAsButton({ href, children, appearance = "primary", className }: ActionLinkProps) {
  const combinedClassName = [styles.actionLink, styles[appearance], className].filter(Boolean).join(" ");
  return (
    <Link href={href} className={combinedClassName}>
      {children}
    </Link>
  );
}
