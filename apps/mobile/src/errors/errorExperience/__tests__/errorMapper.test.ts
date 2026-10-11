import { errorIconRegistry } from "@/components/icons/errorIcons";
import { ApiError } from "@/errors/api.error";

import { describeActionFailure } from "../describeError";
import { buildCatalogEntry } from "../errorCatalog";
import { errorKinds, type ErrorKind } from "../errorKinds";
import { describeErrorSignal, errorKindByCode, resolveErrorKind } from "../errorMapper";
import { readErrorSignal } from "../errorSignal";
import { shouldRetryQuery } from "../globalErrorHandler";
import { formatCountdownClock, parseRetryAfterHeader } from "../retryCountdown";

jest.mock("@/store/auth.store", () => ({ useAuthStore: { getState: () => ({ status: "signedOut" }) } }));

const requiredCodes: Readonly<Record<string, ErrorKind>> = {
  NETWORK_UNAVAILABLE: "offline", TIMEOUT: "timeout", SESSION_EXPIRED: "sessionExpired", UNAUTHENTICATED: "signedOut", FORBIDDEN: "forbidden", STEP_UP_REQUIRED: "stepUpRequired",
  VERIFICATION_REQUIRED: "verificationRequired", RATE_LIMITED: "rateLimited", MAINTENANCE: "maintenance", UPSTREAM_UNAVAILABLE: "maintenance", PAYMENT_AMOUNT_OUT_OF_RANGE: "paymentLimit",
  WALLET_DAILY_LIMIT: "paymentLimit", SELLER_DEBT_LIMIT: "sellerDebtLimit", COUNTRY_REQUIRED: "countryRequired", PRODUCT_NOT_AVAILABLE_IN_REGION: "regionUnavailable", ACCOUNT_SUSPENDED: "accountSuspended",
  RESTRICTED: "accountRestricted", APP_UPDATE_REQUIRED: "updateRequired", ACCOUNT_PRIVATE: "contentPrivate", BLOCKED: "contentBlocked", DECRYPTION_FAILED: "decryptionFailed", LIVE_ENDED: "liveUnavailable",
  LINK_EXPIRED: "linkExpired", AD_LINK_INVALID: "linkExpired", INVITE_NOT_FOUND: "inviteInvalid", FILE_TOO_LARGE: "fileTooLarge", UNSUPPORTED_MEDIA_TYPE: "unsupportedFile", UPLOAD_INCOMPLETE: "uploadFailed",
  PRODUCT_LIMIT_REACHED: "quotaReached", PLAN_FEATURE_REQUIRED: "planFeatureRequired", SENSITIVE_CONTENT: "sensitiveContent", CONTENT_REMOVED: "contentRemoved", TAKEN_DOWN: "contentRemoved",
  ORDER_NOT_FOUND: "orderNotFound", STORE_CLOSED: "storeClosed", OUT_OF_STOCK: "outOfStock", FLASH_SALE_SOLD_OUT: "outOfStock", CHECKOUT_EXPIRED: "checkoutExpired", CART_CHANGED: "cartChanged",
  ALREADY_PAID: "alreadyDone", IDEMPOTENCY_KEY_REUSED: "alreadyDone", VERSION_CONFLICT: "versionConflict", CLOCK_SKEW: "clockSkew", NOT_DELIVERABLE: "deliveryUnavailable",
  EMAIL_NOT_VERIFIED: "emailNotVerified", VERIFY_EMAIL_REQUIRED: "emailNotVerified", TOO_MANY_LOGIN_ATTEMPTS: "tooManyAttempts", ACCOUNT_LOCKED: "tooManyAttempts",
  HUMAN_VERIFICATION_FAILED: "securityCheckFailed", PAYMENT_FAILED: "paymentFailed", PAYMENT_PENDING: "paymentPending", CAMERA_PERMISSION_DENIED: "permissionDenied",
  MICROPHONE_PERMISSION_DENIED: "permissionDenied", LOCATION_PERMISSION_DENIED: "permissionDenied", MEDIA_UNAVAILABLE: "mediaFailed", NOT_FOUND: "notFound", PRODUCT_NOT_FOUND: "contentGone", INTERNAL: "serverError",
  PROFILE_LIMIT_STORE_OR_BUSINESS: "profileLimit", PROFILE_LIMIT_ONE_BRAND: "profileLimit", PROFILE_ON_HOLD: "profileLimit", BRAND_SELLING_OFF: "profileLimit",
};

describe("mobile code → screen mapper", () => {
  test.each(Object.entries(requiredCodes))("maps %s to %s", (code, kind) => {
    expect(resolveErrorKind({ code }).kind).toBe(kind);
  });

  test("every registered code has copy and a registered icon", () => {
    for (const [code, [kind]] of Object.entries(errorKindByCode)) {
      const descriptor = describeErrorSignal({ code });
      expect(descriptor.kind).toBe(kind);
      expect(descriptor.title.length).toBeGreaterThan(0);
      expect(errorIconRegistry[descriptor.icon]).toBeDefined();
    }
  });

  test("no kind falls back to generic 'something went wrong' copy", () => {
    for (const kind of errorKinds) expect(buildCatalogEntry(kind, {}).title).not.toMatch(/something went wrong/i);
  });

  test("falls back on status codes", () => {
    expect(resolveErrorKind({ status: 426 }).kind).toBe("updateRequired");
    expect(resolveErrorKind({ status: 503 }).kind).toBe("maintenance");
    expect(resolveErrorKind({ status: 429 }).kind).toBe("rateLimited");
    expect(resolveErrorKind({ status: 500 }).kind).toBe("serverError");
  });

  test("reads RN network failures and client timeouts", () => {
    expect(resolveErrorKind(readErrorSignal(new TypeError("Network request failed"))).kind).toBe("offline");
    expect(resolveErrorKind(readErrorSignal(Object.assign(new Error("Aborted"), { name: "AbortError" }))).kind).toBe("timeout");
  });

  test("carries the request id and Retry-After from ApiError", () => {
    const descriptor = describeErrorSignal(readErrorSignal(new ApiError(429, "raw backend text", "RATE_LIMITED", undefined, undefined, { requestId: "zm-1", retryAfterSeconds: 30 })));
    expect(descriptor.reference).toBe("zm-1");
    expect(descriptor.retryAfterSeconds).toBe(30);
    expect(JSON.stringify(descriptor)).not.toContain("raw backend text");
  });

  test("keeps the E2EE copy and the copyright ladder", () => {
    expect(describeErrorSignal({ code: "DECRYPTION_FAILED", details: { reason: "NOT_FOR_THIS_DEVICE" } }).description).toBe("Sent before this device joined secure chat.");
    expect(describeErrorSignal({ code: "ACCOUNT_SUSPENDED", details: { reason: "copyright" } }).description).toMatch(/second copyright strike within 12 months/);
  });

  test("mobile asks for an app update when a live needs a newer build", () => {
    expect(describeErrorSignal({ code: "LIVE_REQUIRES_APP", details: { reason: "needsApp" } }).primary).toBe("update");
  });

  test("parses Retry-After for the countdown", () => {
    expect(parseRetryAfterHeader("42")).toBe(42);
    expect(formatCountdownClock(42)).toBe("0:42");
  });

  test("does not retry client errors but retries transient failures once", () => {
    expect(shouldRetryQuery(0, new ApiError(404, "x", "NOT_FOUND"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(426, "x", "APP_UPDATE_REQUIRED"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(503, "x"))).toBe(true);
    expect(shouldRetryQuery(1, new ApiError(503, "x"))).toBe(false);
  });

  test("action failures keep specific backend validation copy but map known codes", () => {
    expect(describeActionFailure(new ApiError(409, "That username is taken.", "USERNAME_UNAVAILABLE"))).toBe("That username is taken.");
    expect(describeActionFailure(new ApiError(429, "raw", "RATE_LIMITED"))).toMatch(/Wait a moment/);
    expect(describeActionFailure(new TypeError("Network request failed"))).toMatch(/Check your data or Wi-Fi/);
  });
});
