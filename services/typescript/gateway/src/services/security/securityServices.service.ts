import type { Logger } from "@nantty/fastify-platform";

import type { SecurityConfig } from "../../configs/security.config.js";
import type { ValkeyConnection } from "../valkeyConnection.service.js";
import { AccessProbeDetector } from "./accessProbeDetector.service.js";
import { CachedChallengeStateSource, HumanVerificationGate } from "./humanVerificationGate.service.js";
import { HCaptchaVerificationProvider, TurnstileVerificationProvider, type HumanVerificationProvider } from "./humanVerificationProvider.service.js";
import { InMemorySecurityStore, ValkeySecurityStore, type SecurityStore } from "./securityStore.service.js";
import { HttpTrustSecurityClient, type TrustSecurityClient } from "./securitySignalSink.service.js";

export interface SecurityServices {
  readonly store: SecurityStore;
  readonly detector: AccessProbeDetector;
  readonly trust?: TrustSecurityClient;
  readonly gate?: HumanVerificationGate;
  readonly states?: CachedChallengeStateSource;
  readonly provider?: HumanVerificationProvider;
  readonly attemptsPerMinute: number;
}

export interface SecurityServiceOverrides {
  readonly store?: SecurityStore;
  readonly trust?: TrustSecurityClient;
  readonly provider?: HumanVerificationProvider;
}

export function buildSecurityServices(config: SecurityConfig | null | undefined, trustBaseUrl: string, logger: Logger, connection: ValkeyConnection | undefined, overrides: SecurityServiceOverrides = {}): SecurityServices {
  const memory = new InMemorySecurityStore();
  const warn = (message: string) => (error: unknown) => logger.warn(message, { error: error instanceof Error ? error.message : String(error) });
  const store = overrides.store ?? (connection === undefined ? memory : new ValkeySecurityStore(connection, memory, warn("valkey security store unavailable; using in-memory windows")));
  const trust = overrides.trust ?? (config === null || config === undefined ? undefined : new HttpTrustSecurityClient(trustBaseUrl, config.trustInternalToken));
  const detector = new AccessProbeDetector(store, trust, config?.probeThresholds, warn("access violation report failed"));
  if (trust === undefined) return { store, detector, attemptsPerMinute: 10 };
  const states = new CachedChallengeStateSource(trust);
  const verification = config?.humanVerification;
  const provider = overrides.provider ?? (verification === undefined ? undefined : verification.provider === "hcaptcha"
    ? new HCaptchaVerificationProvider(verification.secretKey, verification.siteKey, verification.expectedHostnames)
    : new TurnstileVerificationProvider(verification.secretKey, verification.expectedHostnames));
  return { store, detector, trust, states, gate: new HumanVerificationGate(states, store), ...(provider === undefined ? {} : { provider }), attemptsPerMinute: verification?.attemptsPerMinute ?? 10 };
}
