/** @jsxRuntime automatic @jsxImportSource react */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { buildCatalogEntry } from "../errorCatalog";
import { errorKinds, type ErrorKind } from "../errorKinds";
import { describeErrorSignal, errorKindByCode, resolveErrorKind } from "../errorMapper";
import { readErrorSignal, readRequestIdHeader } from "../errorSignal";
import { formatCountdownClock, formatWaitDuration, parseRetryAfterHeader, remainingSeconds } from "../retryCountdown";
import { errorIconRegistry } from "../errorIcons";
import { emptyCatalog, emptyKinds } from "../emptyCatalog";
import { NotFoundScreen } from "../notFoundScreen";
import { ErrorExperienceProvider } from "../errorExperience.context";
import { ErrorState } from "../errorState";
import { RouteErrorScreen } from "../routeErrorScreen";

const requiredCodes: Readonly<Record<string, ErrorKind>> = {
  NETWORK_UNAVAILABLE: "offline", TIMEOUT: "timeout", SESSION_EXPIRED: "sessionExpired", UNAUTHENTICATED: "signedOut", INVALID_CREDENTIALS: "unknown", INVALID_PASSWORD: "unknown", FORBIDDEN: "forbidden", STEP_UP_REQUIRED: "stepUpRequired",
  VERIFICATION_REQUIRED: "verificationRequired", RATE_LIMITED: "rateLimited", MAINTENANCE: "maintenance", UPSTREAM_UNAVAILABLE: "maintenance", PAYMENT_AMOUNT_OUT_OF_RANGE: "paymentLimit",
  WALLET_DAILY_LIMIT: "paymentLimit", SELLER_DEBT_LIMIT: "sellerDebtLimit", COUNTRY_REQUIRED: "countryRequired", PRODUCT_NOT_AVAILABLE_IN_REGION: "regionUnavailable", ACCOUNT_SUSPENDED: "accountSuspended",
  RESTRICTED: "accountRestricted", APP_UPDATE_REQUIRED: "updateRequired", ACCOUNT_PRIVATE: "contentPrivate", BLOCKED: "contentBlocked", DECRYPTION_FAILED: "decryptionFailed", LIVE_ENDED: "liveUnavailable",
  LINK_EXPIRED: "linkExpired", AD_LINK_INVALID: "linkExpired", INVITE_NOT_FOUND: "inviteInvalid", FILE_TOO_LARGE: "fileTooLarge", UNSUPPORTED_MEDIA_TYPE: "unsupportedFile", UPLOAD_INCOMPLETE: "uploadFailed",
  PRODUCT_LIMIT_REACHED: "quotaReached", PLAN_FEATURE_REQUIRED: "planFeatureRequired", SENSITIVE_CONTENT: "sensitiveContent", CONTENT_REMOVED: "contentRemoved", TAKEN_DOWN: "contentRemoved",
  ORDER_NOT_FOUND: "orderNotFound", STORE_CLOSED: "storeClosed", OUT_OF_STOCK: "outOfStock", FLASH_SALE_SOLD_OUT: "outOfStock", CHECKOUT_EXPIRED: "checkoutExpired", CART_CHANGED: "cartChanged",
  ALREADY_PAID: "alreadyDone", IDEMPOTENCY_KEY_REUSED: "alreadyDone", VERSION_CONFLICT: "versionConflict", BROWSER_NOT_SUPPORTED: "unsupportedBrowser", COOKIES_DISABLED: "storageDisabled",
  CLOCK_SKEW: "clockSkew", NOT_DELIVERABLE: "deliveryUnavailable", EMAIL_NOT_VERIFIED: "emailNotVerified", VERIFY_EMAIL_REQUIRED: "emailNotVerified", TOO_MANY_LOGIN_ATTEMPTS: "tooManyAttempts",
  ACCOUNT_LOCKED: "tooManyAttempts", HUMAN_VERIFICATION_FAILED: "securityCheckFailed", EMBED_UNAVAILABLE: "embedUnavailable", PAYMENT_FAILED: "paymentFailed", PAYMENT_PENDING: "paymentPending",
  CAMERA_PERMISSION_DENIED: "permissionDenied", MEDIA_UNAVAILABLE: "mediaFailed", NOT_FOUND: "notFound", PRODUCT_NOT_FOUND: "contentGone", INTERNAL: "serverError",
  PROFILE_LIMIT_STORE_OR_BUSINESS: "profileLimit", PROFILE_LIMIT_ONE_BRAND: "profileLimit", PROFILE_ON_HOLD: "profileLimit", BRAND_SELLING_OFF: "profileLimit",
  REALTIME_UNAVAILABLE: "maintenance", ACCOUNT_SUSPENDED_SECURITY: "accountSuspended", CORS_ORIGIN_FORBIDDEN: "forbidden", WIDGET_TOKEN_SCOPE: "forbidden",
  POLICY_ACCEPTANCE_REQUIRED: "verificationRequired", INSTITUTIONAL_EMAIL_NOT_VERIFIED: "emailNotVerified", BLACK_ANNUAL_DISABLED: "planFeatureRequired",
  BLACK_DISCOUNTS_DISABLED: "planFeatureRequired", USERNAME_TAKEN: "versionConflict", VALIDATION_FAILED: "unknown",
};

describe("code → screen mapper", () => {
  for (const [code, kind] of Object.entries(requiredCodes)) {
    it(`maps ${code} to ${kind}`, () => assert.equal(resolveErrorKind({ code }).kind, kind));
  }

  it("maps every registered code to a kind that has copy and an icon", () => {
    for (const [code, [kind]] of Object.entries(errorKindByCode)) {
      const descriptor = describeErrorSignal({ code });
      assert.equal(descriptor.kind, kind, code);
      assert.ok(descriptor.title.length > 0 && descriptor.description.length > 0, code);
      assert.ok(errorIconRegistry[descriptor.icon], `${code} icon ${descriptor.icon}`);
    }
  });

  it("gives every kind distinct, non-generic copy", () => {
    for (const kind of errorKinds) {
      const entry = buildCatalogEntry(kind, {});
      assert.doesNotMatch(entry.title, /something went wrong/i, kind);
      assert.ok(errorIconRegistry[entry.icon], kind);
    }
  });

  it("falls back on the HTTP status when the code is unknown", () => {
    const cases: Array<[number, ErrorKind]> = [[0, "offline"], [401, "signedOut"], [403, "forbidden"], [404, "notFound"], [408, "timeout"], [409, "versionConflict"], [410, "contentGone"], [413, "fileTooLarge"], [426, "updateRequired"], [429, "rateLimited"], [500, "serverError"], [502, "maintenance"], [503, "maintenance"], [504, "timeout"], [418, "unknown"]];
    for (const [status, kind] of cases) assert.equal(resolveErrorKind({ status, code: `HTTP_${status}` }).kind, kind, String(status));
  });

  it("recognises families of codes by suffix", () => {
    assert.equal(resolveErrorKind({ code: "EXPORT_RATE_LIMITED" }).kind, "rateLimited");
    assert.equal(resolveErrorKind({ code: "USERS_INTELLIGENCE_TIMEOUT" }).kind, "timeout");
    assert.equal(resolveErrorKind({ code: "WIDGET_LIMIT_REACHED" }).kind, "quotaReached");
  });

  it("infers the subject for gone content", () => {
    assert.equal(describeErrorSignal({ code: "STORE_NOT_FOUND" }).title, "This store has closed");
    assert.equal(describeErrorSignal({ code: "LIVE_NOT_FOUND" }).subject, "live");
    assert.equal(describeErrorSignal({ status: 410 }, { subject: "post" }).title, "This post is gone");
  });

  it("names the missing admin permission", () => {
    const descriptor = describeErrorSignal({ status: 403, code: "FORBIDDEN", details: { permission: "users:ban" } }, { describePermission: (key) => (key === "users:ban" ? "Ban users" : undefined) });
    assert.match(descriptor.description, /"Ban users" permission/);
  });

  it("explains wallet limits with the remaining amount", () => {
    const descriptor = describeErrorSignal({ code: "WALLET_DAILY_LIMIT", details: { remaining: { amountMinor: 500000, currency: "NGN" } } });
    assert.match(descriptor.description, /5,000 more from your wallet today/);
    assert.equal(descriptor.primary, "payByCard");
  });

  it("uses the scheduled maintenance message from the backend", () => {
    assert.equal(describeErrorSignal({ status: 503, code: "MAINTENANCE", details: { maintenanceMessage: "Back at 3pm WAT." } }).description, "Back at 3pm WAT.");
  });

  it("keeps the E2EE wording for messages from before this device joined", () => {
    assert.equal(describeErrorSignal({ code: "DECRYPTION_FAILED", details: { reason: "NOT_FOR_THIS_DEVICE" } }).description, "Sent before this device joined secure chat.");
  });

  it("uses the copyright ladder wording for copyright suspensions", () => {
    assert.match(describeErrorSignal({ code: "ACCOUNT_SUSPENDED", details: { reason: "copyright" } }).description, /second copyright strike within 12 months/);
  });

  it("carries the request id and Retry-After through to the descriptor", () => {
    const descriptor = describeErrorSignal(readErrorSignal({ status: 429, code: "RATE_LIMITED", requestId: "req_123", retryAfterSeconds: 42, message: "raw backend text" }));
    assert.equal(descriptor.reference, "req_123");
    assert.equal(descriptor.retryAfterSeconds, 42);
    assert.match(descriptor.description, /42 seconds/);
    assert.doesNotMatch(JSON.stringify(descriptor), /raw backend text/);
  });

  it("reads browser network and timeout failures", () => {
    assert.equal(resolveErrorKind(readErrorSignal(new TypeError("Failed to fetch"))).kind, "offline");
    assert.equal(resolveErrorKind(readErrorSignal(Object.assign(new Error("x"), { name: "TimeoutError" }))).kind, "timeout");
  });

  it("only trusts well-formed request id headers", () => {
    assert.equal(readRequestIdHeader(new Headers({ "x-request-id": "abc-123" })), "abc-123");
    assert.equal(readRequestIdHeader(new Headers({ "x-request-id": "<script>" })), undefined);
  });
});

describe("429 countdown", () => {
  it("parses Retry-After seconds and HTTP dates", () => {
    assert.equal(parseRetryAfterHeader("30"), 30);
    assert.equal(parseRetryAfterHeader(new Date(Date.UTC(2026, 0, 1, 0, 1, 0)).toUTCString(), Date.UTC(2026, 0, 1, 0, 0, 0)), 60);
    assert.equal(parseRetryAfterHeader("soon"), undefined);
  });

  it("formats the remaining time", () => {
    assert.equal(formatCountdownClock(75), "1:15");
    assert.equal(formatWaitDuration(1), "1 second");
    assert.equal(formatWaitDuration(90), "2 minutes");
    assert.equal(remainingSeconds(10_500, 10_000), 1);
    assert.equal(remainingSeconds(10_000, 12_000), 0);
  });

  it("disables retry and shows the countdown while rate limited", () => {
    const html = renderToStaticMarkup(<ErrorState error={{ status: 429, code: "RATE_LIMITED", retryAfterSeconds: 42 }} onRetry={() => undefined} />);
    assert.match(html, /Try again in 0:42/);
    assert.match(html, /<button[^>]*disabled/);
  });
});

describe("screens", () => {
  it("renders the 404 with hero, search and destinations", () => {
    const html = renderToStaticMarkup(
      <ErrorExperienceProvider value={{ homeHref: "/feed", searchHref: "/search", destinations: [{ label: "Mart", href: "/mart", icon: "storefront" }] }}>
        <NotFoundScreen />
      </ErrorExperienceProvider>,
    );
    assert.match(html, /<h1[^>]*tabindex="-1"[^>]*>This page wandered off<\/h1>/);
    assert.match(html, />404</);
    assert.match(html, /role="search"/);
    assert.match(html, /href="\/mart"/);
    assert.match(html, /href="\/feed"[^>]*>Go home/);
  });

  it("announces inline errors as alerts and shows the reference", () => {
    const html = renderToStaticMarkup(<ErrorState error={{ status: 500, code: "INTERNAL", requestId: "req_9" }} onRetry={() => undefined} />);
    assert.match(html, /role="alert"/);
    assert.match(html, /Ref req_9 · Code INTERNAL/);
    assert.doesNotMatch(html, /something went wrong/i);
  });

  it("treats a crashed route as a server error with the digest as reference", () => {
    const html = renderToStaticMarkup(<RouteErrorScreen error={Object.assign(new Error("boom"), { digest: "d1g3st" })} retry={() => undefined} />);
    assert.match(html, /Something broke on our side/);
    assert.match(html, /Ref d1g3st/);
    assert.doesNotMatch(html, /boom/);
  });

  it("has a preset for every empty state", () => {
    for (const kind of emptyKinds) assert.ok(emptyCatalog[kind].title && errorIconRegistry[emptyCatalog[kind].icon], kind);
  });
});
