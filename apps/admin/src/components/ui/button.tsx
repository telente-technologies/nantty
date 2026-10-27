import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import type { NanttyIconName } from "@/constants/nanttyIconNames.constant";

import styles from "./button.module.css";
import { NanttyIcon } from "./nanttyIcon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "quietDanger";
export type ButtonSize = "small" | "medium";

interface SharedButtonProps {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly iconName?: NanttyIconName;
  readonly children?: ReactNode;
}

interface ButtonProps extends SharedButtonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  readonly isBusy?: boolean;
}

function buildButtonClassName(variant: ButtonVariant, size: ButtonSize, extraClassName?: string): string {
  return [styles.button, styles[variant], styles[size], extraClassName].filter(Boolean).join(" ");
}

export function Button({ variant = "secondary", size = "medium", iconName, isBusy = false, children, className, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buildButtonClassName(variant, size, className)} disabled={disabled || isBusy} aria-busy={isBusy || undefined} {...rest}>
      {isBusy ? <span className={styles.spinner} aria-hidden /> : iconName ? <NanttyIcon name={iconName} size={size === "small" ? 14 : 16} /> : null}
      {children ? <span>{children}</span> : null}
    </button>
  );
}

interface ButtonLinkProps extends SharedButtonProps {
  readonly href: string;
  readonly className?: string;
  readonly ariaLabel?: string;
}

export function ButtonLink({ href, variant = "secondary", size = "medium", iconName, children, className, ariaLabel }: ButtonLinkProps) {
  return (
    <Link href={href} className={buildButtonClassName(variant, size, className)} aria-label={ariaLabel}>
      {iconName ? <NanttyIcon name={iconName} size={size === "small" ? 14 : 16} /> : null}
      {children ? <span>{children}</span> : null}
    </Link>
  );
}
