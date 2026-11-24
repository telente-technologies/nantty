"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BookOpenIcon, MagnifyingGlassIcon, TerminalWindowIcon, WarningCircleIcon, XIcon } from "@/components/ui/icons";
import { readDeveloperDocsHref, readSandboxPortalUrl } from "@/config/site.config";

import { apiReferenceEndpoints } from "./apiReferenceData";
import styles from "./publicDocsShell.module.css";

interface SearchEntry {
  readonly id: string;
  readonly kind: "guide" | "endpoint" | "error";
  readonly title: string;
  readonly subtitle: string;
  readonly badge?: string;
  readonly href: string;
}

export function DocsSearchTrigger() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo<readonly SearchEntry[]>(() => {
    const guides: SearchEntry[] = [
      { id: "home", kind: "guide", title: "Developer Overview", subtitle: "Platform readiness, integration workflow, and API tiers", href: "/" },
      { id: "quickstart", kind: "guide", title: "Quickstart Guide", subtitle: "Authenticate with PKCE SSO and send your first Sandbox message", href: readDeveloperDocsHref("quickstart") },
      { id: "api-reference", kind: "guide", title: "Interactive API Reference", subtitle: "Full endpoint specs, headers, status samples, and multi-language code", href: readDeveloperDocsHref("api-reference") },
      { id: "business-messaging", kind: "guide", title: "Business Messaging API", subtitle: "Consented conversations, idempotency, and privacy boundaries", href: readDeveloperDocsHref("business-messaging") },
      { id: "authentication", kind: "guide", title: "Authentication, SSO & Step-Up OTP", subtitle: "PKCE S256 SSO, ntsb_test_ / ntlive_ keys, and 6-digit OTP verification", href: readDeveloperDocsHref("authentication") },
      { id: "webhooks", kind: "guide", title: "Webhooks & HMAC Signatures", subtitle: "Ownership challenges, SSRF defenses, and nantty-signature verification", href: readDeveloperDocsHref("webhooks") },
      { id: "sandbox", kind: "guide", title: "Sandbox Guide", subtitle: "Synthetic customers, deterministic scenarios, and daily/monthly quotas", href: readDeveloperDocsHref("sandbox") },
      { id: "errors", kind: "guide", title: "Error Codes Reference", subtitle: "400, 401, 403, 404, 409, 429, and 503 payloads", href: readDeveloperDocsHref("errors") },
      { id: "rate-limits", kind: "guide", title: "Rate Limits & Quotas", subtitle: "Sandbox and organization production monthly request tiers", href: readDeveloperDocsHref("rate-limits") },
      { id: "login", kind: "guide", title: "Developer Sign-in & OTP Verification", subtitle: "PKCE SSO sign-in and 6-digit email step-up verification", href: "/login" },
      { id: "sandbox-portal", kind: "guide", title: "Launch Isolated Sandbox Console", subtitle: "Issue ntsb_test_ credentials and simulate conversations", href: readSandboxPortalUrl() },
    ];

    const endpoints: SearchEntry[] = apiReferenceEndpoints.map((ep) => ({
      id: `ep-${ep.id}`,
      kind: "endpoint",
      title: ep.title,
      subtitle: `${ep.path} · ${ep.group}`,
      badge: ep.method,
      href: `${readDeveloperDocsHref("api-reference")}#${ep.id}`,
    }));

    const errors: SearchEntry[] = [
      { id: "err-409", kind: "error", title: "IDEMPOTENCY_CONFLICT (409)", subtitle: "Idempotency-Key reused with a different payload", badge: "409", href: readDeveloperDocsHref("errors") },
      { id: "err-429", kind: "error", title: "SANDBOX_QUOTA_EXCEEDED (429)", subtitle: "Monthly Sandbox message quota reached; check details.resetAt", badge: "429", href: readDeveloperDocsHref("errors") },
      { id: "err-503", kind: "error", title: "BUSINESS_MESSAGING_UNAVAILABLE (503)", subtitle: "Production send endpoint remains gated pending dispatch launch", badge: "503", href: readDeveloperDocsHref("errors") },
    ];

    return [...endpoints, ...guides, ...errors];
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries.slice(0, 9);
    return entries.filter((entry) => `${entry.title} ${entry.subtitle} ${entry.badge ?? ""}`.toLowerCase().includes(q));
  }, [entries, query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    if (href.startsWith("http")) {
      window.location.assign(href);
      return;
    }
    router.push(href);
  }

  return (
    <>
      <button type="button" className={styles.searchTrigger} onClick={() => setOpen(true)} aria-label="Search documentation and API endpoints">
        <MagnifyingGlassIcon size={15} />
        <span className={styles.searchTriggerText}>Search docs &amp; endpoints…</span>
        <kbd className={styles.searchKbd}>⌘K</kbd>
      </button>

      {open ? (
        <div className={styles.searchBackdrop} role="presentation" onClick={() => setOpen(false)}>
          <div
            className={styles.searchDialog}
            role="dialog"
            aria-modal="true"
            aria-label="Search documentation"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.searchInputRow}>
              <MagnifyingGlassIcon size={18} />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search endpoints, status codes, guides (e.g. idempotency, 429, OTP)…"
                aria-label="Search query"
              />
              <button type="button" className={styles.searchCloseBtn} onClick={() => setOpen(false)} aria-label="Close search">
                <XIcon size={16} />
              </button>
            </div>
            <ul className={styles.searchResults}>
              {filtered.length === 0 ? (
                <li className={styles.searchEmpty}>No matching guides or endpoints found for &ldquo;{query}&rdquo;.</li>
              ) : (
                filtered.map((item) => (
                  <li key={item.id}>
                    <button type="button" className={styles.searchResultBtn} onClick={() => navigate(item.href)}>
                      <span className={styles.searchResultIcon}>
                        {item.kind === "endpoint" ? <TerminalWindowIcon size={16} /> : item.kind === "error" ? <WarningCircleIcon size={16} /> : <BookOpenIcon size={16} />}
                      </span>
                      <span className={styles.searchResultText}>
                        <strong>{item.title}</strong>
                        <small>{item.subtitle}</small>
                      </span>
                      {item.badge ? <span className={styles.searchBadge}>{item.badge}</span> : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
