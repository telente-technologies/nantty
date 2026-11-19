"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type DeveloperEnvironment = "sandbox" | "production";

export interface DeveloperOrganizationItem {
  readonly id: string;
  readonly name: string;
  readonly slug?: string;
  readonly role?: string;
}

export interface DeveloperApplicationItem {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly environment?: string;
  readonly createdAt?: string;
}

export interface DeveloperSessionState {
  readonly configured: boolean;
  readonly authenticated: boolean;
}

interface DeveloperContextValue {
  readonly environment: DeveloperEnvironment;
  readonly setEnvironment: (env: DeveloperEnvironment) => void;
  readonly session: DeveloperSessionState;
  readonly organizations: readonly DeveloperOrganizationItem[];
  readonly organizationId: string;
  readonly setOrganizationId: (id: string) => void;
  readonly applications: readonly DeveloperApplicationItem[];
  readonly applicationId: string;
  readonly setApplicationId: (id: string) => void;
  readonly loading: boolean;
  readonly authError: string;
  readonly refreshOrganizations: () => Promise<void>;
  readonly refreshApplications: () => Promise<void>;
}

const DeveloperContext = createContext<DeveloperContextValue | null>(null);
const envStorageKey = "nantty.developer.environment";

export function DeveloperContextProvider({ children }: { readonly children: ReactNode }) {
  const [environment, setEnvironmentState] = useState<DeveloperEnvironment>("sandbox");
  const [session, setSession] = useState<DeveloperSessionState>({ configured: false, authenticated: false });
  const [organizations, setOrganizations] = useState<readonly DeveloperOrganizationItem[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [applications, setApplications] = useState<readonly DeveloperApplicationItem[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(envStorageKey);
      if (saved === "sandbox" || saved === "production") setEnvironmentState(saved);
    } catch {
      // Ignore storage failures in restricted contexts.
    }
  }, []);

  const setEnvironment = useCallback((env: DeveloperEnvironment) => {
    setEnvironmentState(env);
    try {
      window.sessionStorage.setItem(envStorageKey, env);
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const refreshOrganizations = useCallback(async () => {
    setLoading(true);
    setAuthError("");
    try {
      const [sessionRes, orgRes] = await Promise.all([
        fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/developer/organizations", { credentials: "same-origin", cache: "no-store" }),
      ]);
      if (sessionRes.ok) {
        const s = (await sessionRes.json()) as DeveloperSessionState;
        setSession(s);
      }
      if (!orgRes.ok) {
        const errPayload = (await orgRes.json().catch(() => null)) as { message?: string } | null;
        setAuthError(errPayload?.message ?? "Sign in with your Nantty account to manage organizations.");
        setOrganizations([]);
        setOrganizationId("");
        return;
      }
      const payload = (await orgRes.json()) as { organizations?: DeveloperOrganizationItem[] };
      const items = payload.organizations ?? [];
      setOrganizations(items);
      setOrganizationId((current) => (items.some((i) => i.id === current) ? current : (items[0]?.id ?? "")));
    } catch {
      setAuthError("Could not reach the developer organization service.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshApplications = useCallback(async () => {
    if (!organizationId) {
      setApplications([]);
      setApplicationId("");
      return;
    }
    try {
      const res = await fetch(`/api/developer/organizations/${encodeURIComponent(organizationId)}/applications`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) {
        setApplications([]);
        setApplicationId("");
        return;
      }
      const payload = (await res.json()) as { applications?: DeveloperApplicationItem[] };
      const items = payload.applications ?? [];
      setApplications(items);
      setApplicationId((current) => (items.some((i) => i.id === current) ? current : (items[0]?.id ?? "")));
    } catch {
      setApplications([]);
      setApplicationId("");
    }
  }, [organizationId]);

  useEffect(() => {
    void refreshOrganizations();
  }, [refreshOrganizations]);

  useEffect(() => {
    void refreshApplications();
  }, [refreshApplications]);

  return (
    <DeveloperContext.Provider
      value={{
        environment,
        setEnvironment,
        session,
        organizations,
        organizationId,
        setOrganizationId,
        applications,
        applicationId,
        setApplicationId,
        loading,
        authError,
        refreshOrganizations,
        refreshApplications,
      }}
    >
      {children}
    </DeveloperContext.Provider>
  );
}

export function useDeveloperContext(): DeveloperContextValue {
  const ctx = useContext(DeveloperContext);
  if (!ctx) throw new Error("useDeveloperContext must be used inside DeveloperContextProvider");
  return ctx;
}
