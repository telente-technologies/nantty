"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./developerOverview.module.css";

type ReadinessResponse = {
  service: string;
  state: "ready" | "unavailable" | "not_configured";
  checkedAt: string;
};

function isReadinessResponse(value: unknown): value is ReadinessResponse {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Partial<ReadinessResponse>;
  return typeof result.service === "string" &&
    (result.state === "ready" || result.state === "unavailable" || result.state === "not_configured") &&
    typeof result.checkedAt === "string";
}

const stateLabels: Record<ReadinessResponse["state"], string> = {
  ready: "Operational",
  unavailable: "Unavailable",
  not_configured: "Not configured",
};

async function fetchGatewayReadiness(): Promise<ReadinessResponse> {
  try {
    const response = await fetch("/api/platform-readiness", { cache: "no-store" });
    if (!response.ok) throw new Error("Readiness request failed");
    const payload: unknown = await response.json();
    if (!isReadinessResponse(payload)) throw new Error("Readiness response was invalid");
    return payload;
  } catch {
    return { service: "Nantty API gateway", state: "unavailable", checkedAt: new Date().toISOString() };
  }
}

export function GatewayReadiness() {
  const [result, setResult] = useState<ReadinessResponse>();
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await fetchGatewayReadiness());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchGatewayReadiness().then((payload) => {
      if (!active) return;
      setResult(payload);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const label = loading ? "Checking" : result ? stateLabels[result.state] : "Unavailable";
  const detail = loading
    ? "Checking the gateway readiness endpoint"
    : result?.state === "ready"
      ? "Gateway is responding to readiness checks. Developer data APIs are not implied by this check."
      : result?.state === "not_configured"
        ? "Gateway readiness is not configured for this deployment."
        : "The configured gateway did not return a successful readiness response.";

  return (
    <div className={styles.readinessRow} aria-live="polite">
      <div className={styles.readinessCopy}>
        <span className={styles.readinessService}>{result?.service ?? "Nantty API gateway"}</span>
        <span className={styles.readinessDetail}>{detail}</span>
      </div>
      <div className={styles.readinessActions}>
        <span className={`${styles.readinessState} ${result?.state === "ready" ? styles.readinessReady : ""}`}>
          {loading && <span className={styles.loadingMark} aria-hidden="true" />}{label}
        </span>
        <button className={styles.refreshButton} type="button" onClick={() => void refresh()} disabled={loading}>
          Refresh
        </button>
      </div>
    </div>
  );
}
