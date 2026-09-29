import { randomBytes } from "node:crypto";

import { UnauthorizedError } from "@zudojs/errors";
import { createRouter } from "@zudojs/http";
import { createHttpTestClient } from "@zudojs/testing";

import type { AppSettings } from "../../src/configs/settings.config.js";
import { createDependencies, type AppDependencies, type ExternalServices } from "../../src/container.js";
import { Role } from "../../src/constants/roles.constant.js";
import type { Clock } from "../../src/interfaces/clock.interface.js";
import { createAppLogger } from "../../src/loggers/app.logger.js";
import type { OtpPurpose, SocialProvider, VerifiedSocialIdentity } from "../../src/modules/auth/models/auth.model.js";
import type { ContactAddress } from "../../src/modules/auth/services/contact.service.js";
import { StaticBankDirectory } from "../../src/modules/wallets/services/bankDirectory.service.js";
import { registerRoutes } from "../../src/routes/index.js";
import { createApplicationRouterOptions } from "../../src/utils/http.util.js";

export class AdjustableClock implements Clock {
  private current = new Date("2026-09-01T09:00:00.000Z");

  public now(): Date {
    return new Date(this.current);
  }

  public advanceBySeconds(seconds: number): void {
    this.current = new Date(this.current.getTime() + seconds * 1000);
  }
}

export class CapturedOneTimeCodes {
  public readonly codes = new Map<string, string>();

  public async deliverOneTimeCode(contact: ContactAddress, code: string, purpose: OtpPurpose): Promise<void> {
    this.codes.set(`${purpose}:${contact.value}`, code);
  }

  public latestCodeFor(target: string, purpose: OtpPurpose): string | undefined {
    return this.codes.get(`${purpose}:${target}`);
  }
}

export class FakeIdentityTokenVerifier {
  public readonly identities = new Map<string, VerifiedSocialIdentity>();

  public async verifyIdentityToken(provider: SocialProvider, idToken: string): Promise<VerifiedSocialIdentity> {
    const identity = this.identities.get(`${provider}:${idToken}`);
    if (identity === undefined) throw new UnauthorizedError("Invalid identity token.");
    return identity;
  }
}

export function createTestSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    auth: {
      accessSecret: "test-access-secret-that-is-long-enough-000",
      refreshSecret: "test-refresh-secret-that-is-long-enough-111",
      accessTtlSeconds: 900,
      refreshTtlSeconds: 30 * 86_400,
      otpTtlSeconds: 300,
      otpMaxAttempts: 5,
      googleClientIds: ["google-client"],
      appleClientIds: ["apple-client"],
      sensitiveRateLimit: { windowMs: 60_000, max: 0 },
    },
    dataEncryptionKey: new Uint8Array(randomBytes(32)),
    money: { commissionBps: 500, escrowInspectionDays: 3 },
    locale: { trustedCountryHeader: "cf-ipcountry" },
    exchangeRates: { provider: "static", refreshIntervalMinutes: 60 },
    payments: {
      paystackSecretKey: "sk_test_paystack_secret",
      flutterwaveSecretKey: "FLWSECK_TEST-secret",
      flutterwaveWebhookHash: "flutterwave-webhook-hash",
      callbackUrl: "https://app.zudomart.test/payments/callback",
    },
    media: {
      signingSecret: "test-media-signing-secret-that-is-long-enough",
      publicBaseUrl: "",
      maxImageBytes: 1024 * 1024,
      maxVideoBytes: 4 * 1024 * 1024,
      urlTtlSeconds: 900,
    },
    ...overrides,
  };
}

export interface SignedInUser {
  readonly userId: string;
  readonly username: string;
  readonly email: string;
  readonly password: string;
  readonly accessToken: string;
  readonly refreshToken: string;
}

export interface TestApplicationOptions {
  readonly settings?: Partial<AppSettings>;
  readonly external?: ExternalServices;
}

export function createTestApplication(options: TestApplicationOptions = {}) {
  const clock = new AdjustableClock();
  const oneTimeCodes = new CapturedOneTimeCodes();
  const identityTokens = new FakeIdentityTokenVerifier();
  const dependencies: AppDependencies = createDependencies({
    settings: createTestSettings(options.settings),
    persistence: "memory",
    clock,
    logger: createAppLogger("test"),
    external: { oneTimeCodeDelivery: oneTimeCodes, identityTokenVerifier: identityTokens, bankDirectory: new StaticBankDirectory(), ...options.external },
  });
  const router = createRouter(createApplicationRouterOptions());
  registerRoutes(router, dependencies);
  const client = createHttpTestClient(router);
  let userCounter = 0;

  async function registerUser(overrides: { readonly username?: string; readonly roles?: readonly string[] } = {}): Promise<SignedInUser> {
    userCounter += 1;
    const username = overrides.username ?? `user${userCounter}${randomBytes(2).toString("hex")}`;
    const email = `${username}@example.com`;
    const password = "Secret-pass-123";
    const otpToken = await verifyDestinationForSignup(email);
    const registered = await client
      .post("/api/v1/auth/register")
      .send({ email, username, password, birthday: "1995-05-20", name: `User ${userCounter}`, otpToken })
      .expect(201);
    const userId = registered.json<{ user: { id: string } }>().user.id;
    for (const role of overrides.roles ?? []) await dependencies.ports.userDirectory.grantRole(userId, role);
    const login = await client.post("/api/v1/auth/login").send({ identifier: email, password }).expect(200);
    const tokens = login.json<{ accessToken: string; refreshToken: string }>();
    return { userId, username, email, password, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async function verifyDestinationForSignup(destination: string): Promise<string> {
    await client.post("/api/v1/auth/otp/send").send({ destination, purpose: "signup" }).expect(200);
    const code = oneTimeCodes.latestCodeFor(destination.toLowerCase(), "signup");
    const verified = await client.post("/api/v1/auth/otp/verify").send({ destination, code, purpose: "signup" }).expect(200);
    return verified.json<{ otpToken: string }>().otpToken;
  }

  return {
    client,
    dependencies,
    clock,
    oneTimeCodes,
    identityTokens,
    registerUser,
    registerSeller: () => registerUser({ roles: [Role.SELLER] }),
    registerAdmin: () => registerUser({ roles: [Role.ADMIN] }),
    verifyDestinationForSignup,
    close: () => client.close(),
  };
}

export type TestApplication = ReturnType<typeof createTestApplication>;
