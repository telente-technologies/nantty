/** @jsxRuntime automatic */
/** @jsxImportSource react */
"use client";

import { ErrorLink, useErrorExperience, type ErrorDestination } from "./errorExperience.context";
import { ErrorIcon } from "./errorIcons";
import type { ErrorKind, ErrorSubject } from "./errorKinds";
import { ErrorState } from "./errorState";
import styles from "./notFoundScreen.module.css";

export interface NotFoundScreenProps {
  readonly kind?: Extract<ErrorKind, "notFound" | "contentGone" | "orderNotFound" | "linkExpired" | "inviteInvalid">;
  readonly subject?: ErrorSubject;
  readonly title?: string;
  readonly description?: string;
  readonly destinations?: readonly ErrorDestination[];
  readonly searchHref?: string | null;
}

export function NotFoundScreen({ kind = "notFound", subject, title, description, destinations, searchHref }: NotFoundScreenProps) {
  const config = useErrorExperience();
  const resolvedSearchHref = searchHref === null ? null : (searchHref ?? config.searchHref ?? null);
  const resolvedDestinations = destinations ?? config.destinations ?? [];
  return (
    <ErrorState kind={kind} subject={subject} variant="page" title={title} description={description}>
      {resolvedSearchHref || resolvedDestinations.length > 0 ? (
        <nav className={styles.explore} aria-label="Keep exploring">
          {resolvedSearchHref ? (
            <form className={styles.search} action={resolvedSearchHref} method="get" role="search">
              <span className={styles.searchIcon} aria-hidden="true">
                <ErrorIcon name="magnifyingGlass" size={18} weight="regular" />
              </span>
              <label htmlFor="not-found-search" className={styles.visuallyHidden}>
                Search Nantty
              </label>
              <input id="not-found-search" name={config.searchParam ?? "q"} type="search" className={styles.searchInput} placeholder={config.searchPlaceholder ?? "Search Nantty"} autoComplete="off" enterKeyHint="search" />
            </form>
          ) : null}
          {resolvedDestinations.length > 0 ? (
            <ul className={styles.destinations}>
              {resolvedDestinations.map((destination) => (
                <li key={destination.href}>
                  <ErrorLink href={destination.href} className={styles.destination}>
                    <ErrorIcon name={destination.icon} size={18} weight="regular" />
                    <span>{destination.label}</span>
                  </ErrorLink>
                </li>
              ))}
            </ul>
          ) : null}
        </nav>
      ) : null}
    </ErrorState>
  );
}
