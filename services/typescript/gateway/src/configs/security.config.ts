import { defaultProbeThresholds, type ProbeThresholds } from "../services/security/accessProbeDetector.service.js";
import type { AccessViolationKind } from "../services/security/accessProbeClassifier.service.js";

export interface SecurityConfig {
  readonly trustInternalToken: string;
  readonly humanVerification: {
    readonly provider: "turnstile" | "hcaptcha";
    readonly secretKey: string;
    readonly siteKey: string;
    readonly expectedHostnames: readonly string[];
    readonly attemptsPerMinute: number;
  };
  readonly probeThresholds: ProbeThresholds;
}

const thresholdVariableNames: Readonly<Record<AccessViolationKind, string>> = {
  forbidden: "FORBIDDEN", privateNotFound: "PRIVATE_NOT_FOUND", idEnumeration: "ID_ENUMERATION", internalPath: "INTERNAL_PATH",
  tamperedToken: "TAMPERED_TOKEN", idempotencyMismatch: "IDEMPOTENCY_MISMATCH", adminRoute: "ADMIN_ROUTE",
};

function readPositiveInteger(name: string, fallback: number): number {
  const parsed = Number(process.env[name]?.trim() ?? "");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadSecurityConfigFromEnvironment(problems: string[]): SecurityConfig | null {
  const trustInternalToken = process.env["TRUST_INTERNAL_TOKEN"]?.trim() ?? "";
  if (trustInternalToken === "") return null;
  const provider = process.env["HUMAN_VERIFICATION_PROVIDER"]?.trim() === "hcaptcha" ? "hcaptcha" : "turnstile";
  const secretKey = (provider === "hcaptcha" ? process.env["HCAPTCHA_SECRET_KEY"] : process.env["TURNSTILE_SECRET_KEY"])?.trim() ?? "";
  const siteKey = (provider === "hcaptcha" ? process.env["HCAPTCHA_SITE_KEY"] : process.env["TURNSTILE_SITE_KEY"])?.trim() ?? "";
  if (secretKey === "") problems.push(`${provider === "hcaptcha" ? "HCAPTCHA_SECRET_KEY" : "TURNSTILE_SECRET_KEY"} is required when TRUST_INTERNAL_TOKEN is set`);
  if (process.env["NODE_ENV"] === "production" && secretKey.startsWith("1x0000000000000000000000000000000")) problems.push("TURNSTILE_SECRET_KEY must not be the Cloudflare test key in production");
  const probeThresholds = Object.fromEntries((Object.keys(defaultProbeThresholds) as AccessViolationKind[]).map((kind) => {
    const fallback = defaultProbeThresholds[kind];
    const variable = thresholdVariableNames[kind];
    return [kind, { count: readPositiveInteger(`SECURITY_PROBE_${variable}_COUNT`, fallback.count), windowSeconds: readPositiveInteger(`SECURITY_PROBE_${variable}_WINDOW_SECONDS`, fallback.windowSeconds) }];
  })) as unknown as ProbeThresholds;
  return {
    trustInternalToken,
    humanVerification: {
      provider, secretKey, siteKey,
      expectedHostnames: (process.env["HUMAN_VERIFICATION_HOSTNAMES"] ?? "").split(",").map((hostname) => hostname.trim()).filter(Boolean),
      attemptsPerMinute: readPositiveInteger("HUMAN_VERIFICATION_ATTEMPTS_PER_MINUTE", 10),
    },
    probeThresholds,
  };
}
