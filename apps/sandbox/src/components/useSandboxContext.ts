"use client";

import { useEffect, useState } from "react";

export type Organization = { readonly id: string; readonly name: string };
export type Application = { readonly id: string; readonly name: string; readonly status: string };
export type UsageSummary = {
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly messagesSent: number;
  readonly requestsCount: number;
  readonly scenariosRun: number;
  readonly quotaLimitMessages: number;
  readonly remainingMessages: number;
};

export async function sandboxFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string; error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? payload?.message ?? "Sandbox request failed.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function useSandboxContext() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [contextError, setContextError] = useState("");

  useEffect(() => {
    let active = true;
    void sandboxFetch<{ organizations: Organization[] }>("/api/sandbox/organizations")
      .then(({ organizations: items }) => {
        if (active) {
          setOrganizations(items);
          setOrganizationId(items[0]?.id ?? "");
        }
      })
      .catch((cause: unknown) => {
        if (active) setContextError(cause instanceof Error ? cause.message : "Sign in to Nantty to access Sandbox applications.");
      })
      .finally(() => { if (active) setLoadingOrgs(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!organizationId) { setApplications([]); setApplicationId(""); return; }
    const controller = new AbortController();
    setApplications([]);
    setApplicationId("");
    setContextError("");
    void sandboxFetch<{ applications: Application[] }>(`/api/sandbox/organizations/${encodeURIComponent(organizationId)}/applications`, { signal: controller.signal })
      .then(({ applications: items }) => {
        if (!controller.signal.aborted) {
          setApplications(items);
          setApplicationId(items[0]?.id ?? "");
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setContextError(cause instanceof Error ? cause.message : "Could not load applications.");
      });
    return () => controller.abort();
  }, [organizationId]);

  return { organizations, organizationId, setOrganizationId, applications, applicationId, setApplicationId, loadingOrgs, contextError };
}
