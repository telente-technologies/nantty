/** @jsxRuntime automatic */
/** @jsxImportSource react */
"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { ErrorActionIntent, ErrorIconName } from "./errorKinds";

export interface ErrorDestination {
  readonly label: string;
  readonly href: string;
  readonly icon: ErrorIconName;
}

export interface ErrorLinkProps {
  readonly href: string;
  readonly className?: string;
  readonly children: ReactNode;
}

export interface ErrorExperienceConfig {
  readonly homeHref: string;
  readonly homeLabel?: string;
  readonly hrefs?: Partial<Record<ErrorActionIntent, string>>;
  readonly handlers?: Partial<Record<ErrorActionIntent, () => void>>;
  readonly labels?: Partial<Record<ErrorActionIntent, string>>;
  readonly describePermission?: (permissionKey: string) => string | undefined;
  readonly searchHref?: string;
  readonly searchPlaceholder?: string;
  readonly searchParam?: string;
  readonly destinations?: readonly ErrorDestination[];
  readonly connectivityProbeUrl?: string;
  readonly renderLink?: (props: ErrorLinkProps) => ReactNode;
}

const defaultConfig: ErrorExperienceConfig = { homeHref: "/" };

const ErrorExperienceContext = createContext<ErrorExperienceConfig>(defaultConfig);

export function ErrorExperienceProvider({ value, children }: { readonly value: ErrorExperienceConfig; readonly children: ReactNode }) {
  return <ErrorExperienceContext.Provider value={value}>{children}</ErrorExperienceContext.Provider>;
}

export function useErrorExperience(): ErrorExperienceConfig {
  return useContext(ErrorExperienceContext);
}

export function ErrorLink({ href, className, children }: ErrorLinkProps) {
  const { renderLink } = useErrorExperience();
  if (renderLink) return <>{renderLink({ href, className, children })}</>;
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
