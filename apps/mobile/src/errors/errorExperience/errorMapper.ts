import { buildCatalogEntry } from "./errorCatalog";
import type { ErrorDescriptor, ErrorKind, ErrorSignal, ErrorSubject } from "./errorKinds";

type CodeRule = readonly [ErrorKind, ErrorSubject?];

export const errorKindByCode: Readonly<Record<string, CodeRule>> = {
  NETWORK_UNAVAILABLE: ["offline"], NETWORK_ERROR: ["offline"], OFFLINE: ["offline"],
  TIMEOUT: ["timeout"], REQUEST_TIMEOUT: ["timeout"], GATEWAY_TIMEOUT: ["timeout"],
  INTERNAL: ["serverError"], INTERNAL_ERROR: ["serverError"], MOCK_FAILURE: ["serverError"],
  MAINTENANCE: ["maintenance"], SERVICE_UNAVAILABLE: ["maintenance"], UPSTREAM_UNAVAILABLE: ["maintenance"], UNAVAILABLE: ["maintenance"], REALTIME_UNAVAILABLE: ["maintenance"],
  RATE_LIMITED: ["rateLimited"], REPORT_RATE_LIMITED: ["rateLimited"], EXPORT_RATE_LIMITED: ["rateLimited"],
  TOO_MANY_ATTEMPTS: ["tooManyAttempts"], TOO_MANY_LOGIN_ATTEMPTS: ["tooManyAttempts"], ACCOUNT_LOCKED: ["tooManyAttempts"],
  APP_UPDATE_REQUIRED: ["updateRequired"], UPDATE_REQUIRED: ["updateRequired"], UNSUPPORTED_APP_VERSION: ["updateRequired"], UPGRADE_REQUIRED: ["updateRequired"],
  BROWSER_NOT_SUPPORTED: ["unsupportedBrowser"], WEBRTC_UNAVAILABLE: ["unsupportedBrowser", "live"],
  STORAGE_DISABLED: ["storageDisabled"], COOKIES_DISABLED: ["storageDisabled"],
  CLOCK_SKEW: ["clockSkew"], TOKEN_NOT_YET_VALID: ["clockSkew"], TOKEN_ISSUED_IN_FUTURE: ["clockSkew"],
  HUMAN_VERIFICATION_FAILED: ["securityCheckFailed"], HUMAN_VERIFICATION_REQUIRED: ["securityCheckFailed"], CAPTCHA_FAILED: ["securityCheckFailed"], TURNSTILE_FAILED: ["securityCheckFailed"],
  NOT_FOUND: ["notFound"], ROUTE_NOT_FOUND: ["notFound"],
  LINK_EXPIRED: ["linkExpired"], LINK_INVALID: ["linkExpired"], AD_LINK_INVALID: ["linkExpired"], OTP_TOKEN_INVALID: ["linkExpired"], RESET_TOKEN_EXPIRED: ["linkExpired"], VERIFICATION_LINK_EXPIRED: ["linkExpired"], SAVED_CARD_HANDOFF_EXPIRED: ["linkExpired"], RESOLUTION_EXPIRED: ["linkExpired"], PASSKEY_CHALLENGE_EXPIRED: ["linkExpired"], PAYMENT_LINK_EXPIRED: ["linkExpired"], EMBED_TOKEN_INVALID: ["linkExpired"],
  INVITE_NOT_FOUND: ["inviteInvalid"], INVITE_EMAIL_MISMATCH: ["inviteInvalid"], INVITE_USER_MISMATCH: ["inviteInvalid"], INVITE_REVOKED: ["inviteInvalid"], INVITE_ALREADY_USED: ["inviteInvalid"], INVITE_EXPIRED: ["inviteInvalid"],
  UNAUTHENTICATED: ["signedOut"], UNAUTHORIZED: ["signedOut"],
  SESSION_EXPIRED: ["sessionExpired"], SESSION_IDLE_TIMEOUT: ["sessionExpired"], SESSION_PRIVILEGES_CHANGED: ["sessionExpired"], INVALID_REFRESH_TOKEN: ["sessionExpired"], REFRESH_TOKEN_REUSED: ["sessionExpired"],
  FORBIDDEN: ["forbidden"], PERMISSION_DENIED: ["forbidden"], SUPERADMIN_REQUIRED: ["forbidden"], IP_NOT_ALLOWED: ["forbidden"], CSRF_REJECTED: ["forbidden"], CORS_ORIGIN_FORBIDDEN: ["forbidden"], CORS_ORIGIN_REQUIRED: ["forbidden"], WIDGET_TOKEN_SCOPE: ["forbidden"],
  STEP_UP_REQUIRED: ["stepUpRequired"], STEP_UP_PROOF_REQUIRED: ["stepUpRequired"], STEP_UP_FAILED: ["stepUpRequired"], STEP_UP_REUSED: ["stepUpRequired"],
  VERIFICATION_REQUIRED: ["verificationRequired"], SELLER_VERIFICATION_REQUIRED: ["verificationRequired"], BVN_REQUIRED: ["verificationRequired"], POLICY_ACCEPTANCE_REQUIRED: ["verificationRequired"],
  VERIFY_EMAIL_REQUIRED: ["emailNotVerified"], EMAIL_NOT_VERIFIED: ["emailNotVerified"], SOCIAL_EMAIL_NOT_VERIFIED: ["emailNotVerified"], INSTITUTIONAL_EMAIL_NOT_VERIFIED: ["emailNotVerified"],
  SUSPENDED: ["accountSuspended"], ACCOUNT_SUSPENDED: ["accountSuspended"], ACCOUNT_SUSPENDED_SECURITY: ["accountSuspended"], ACCOUNT_BANNED: ["accountSuspended"], USER_BANNED: ["accountSuspended"], VIEWER_BANNED: ["accountSuspended"], SIGNUP_BLOCKED: ["accountSuspended"],
  RESTRICTED: ["accountRestricted"], ACCOUNT_RESTRICTED: ["accountRestricted"], LIVE_RESTRICTED: ["accountRestricted"], WALLET_ON_HOLD: ["accountRestricted"], FEATURE_RESTRICTED: ["accountRestricted"],
  DELETED: ["contentGone"], GONE: ["contentGone"], ACCOUNT_DELETED: ["contentGone", "profile"], POST_DELETED: ["contentGone", "post"], POST_NOT_FOUND: ["contentGone", "post"], CLIP_NOT_FOUND: ["contentGone", "clip"], STORY_NOT_FOUND: ["contentGone", "story"],
  PRODUCT_NOT_FOUND: ["contentGone", "product"], PRODUCT_UNAVAILABLE: ["contentGone", "product"], STORE_NOT_FOUND: ["contentGone", "store"], PROFILE_NOT_FOUND: ["contentGone", "profile"], USER_NOT_FOUND: ["contentGone", "profile"], COMMENT_NOT_FOUND: ["contentGone", "comment"],
  ACCOUNT_PRIVATE: ["contentPrivate"], PRIVATE: ["contentPrivate"], PROFILE_PRIVATE: ["contentPrivate"],
  BLOCKED: ["contentBlocked"], USER_BLOCKED: ["contentBlocked"], BLOCKED_BY_USER: ["contentBlocked"], USER_NOT_FOLLOWING_OR_BLOCKED: ["contentBlocked"],
  CONTENT_REMOVED: ["contentRemoved"], TAKEN_DOWN: ["contentRemoved"], REMOVED: ["contentRemoved"], COPYRIGHT: ["contentRemoved"], COPYRIGHT_TAKEDOWN: ["contentRemoved"],
  SENSITIVE_CONTENT: ["sensitiveContent"], AGE_RESTRICTED: ["sensitiveContent"],
  MEDIA_NOT_FOUND: ["mediaFailed"], MEDIA_UNAVAILABLE: ["mediaFailed"], RECORDING_UNAVAILABLE: ["mediaFailed", "video"],
  DECRYPTION_FAILED: ["decryptionFailed"], NOT_FOR_THIS_DEVICE: ["decryptionFailed"],
  LIVE_NOT_FOUND: ["liveUnavailable", "live"], LIVE_ENDED: ["liveUnavailable", "live"], LIVE_REQUIRES_APP: ["liveUnavailable", "live"], STAGE_FULL: ["liveUnavailable", "live"],
  ORDER_NOT_FOUND: ["orderNotFound", "order"],
  STORE_CLOSED: ["storeClosed"], STORE_ON_HOLIDAY: ["storeClosed"], STORE_PAUSED: ["storeClosed"],
  OUT_OF_STOCK: ["outOfStock"], INSUFFICIENT_STOCK: ["outOfStock"], FLASH_SALE_SOLD_OUT: ["outOfStock"], VARIANT_NOT_FOUND: ["outOfStock"],
  PRODUCT_NOT_AVAILABLE_IN_REGION: ["regionUnavailable"], NOT_AVAILABLE_IN_REGION: ["regionUnavailable"], REGION_UNAVAILABLE: ["regionUnavailable"], UNSUPPORTED_CURRENCY: ["regionUnavailable"], CURRENCY_NOT_ALLOWED: ["regionUnavailable"], NO_PRICE_FOR_CURRENCY: ["regionUnavailable"],
  NOT_DELIVERABLE: ["deliveryUnavailable"], DELIVERY_UNAVAILABLE: ["deliveryUnavailable"], SHIPPING_UNAVAILABLE: ["deliveryUnavailable"],
  CHECKOUT_EXPIRED: ["checkoutExpired"], CHECKOUT_CLOSED: ["checkoutExpired"], CHECKOUT_REQUIRED: ["checkoutExpired"],
  CART_CHANGED: ["cartChanged"], PRICE_CHANGED: ["cartChanged"], PRICES_CHANGED: ["cartChanged"], CHECKOUT_PAYABLES_CONFLICT: ["cartChanged"], PAYMENT_AMOUNT_MISMATCH: ["cartChanged"], CONVERSION_RATE_CHANGED: ["cartChanged"],
  PAYMENT_FAILED: ["paymentFailed"], PAYMENT_DECLINED: ["paymentFailed"], INSUFFICIENT_FUNDS: ["paymentFailed"], INSUFFICIENT_COINS: ["paymentFailed"], INSUFFICIENT_AVAILABLE_BALANCE: ["paymentFailed"], PAYMENT_PROVIDER_UNAVAILABLE: ["paymentFailed"],
  PAYMENT_PENDING: ["paymentPending"], PAYMENT_PROCESSING: ["paymentPending"],
  PAYMENT_AMOUNT_OUT_OF_RANGE: ["paymentLimit"], WALLET_DAILY_LIMIT: ["paymentLimit"], WITHDRAWAL_DAILY_LIMIT: ["paymentLimit"], WITHDRAWAL_DAILY_AMOUNT_LIMIT: ["paymentLimit"],
  SELLER_DEBT_LIMIT: ["sellerDebtLimit"], WALLET_DEBT_OUTSTANDING: ["sellerDebtLimit"],
  PROFILE_LIMIT_STORE_OR_BUSINESS: ["profileLimit"], PROFILE_LIMIT_ONE_BRAND: ["profileLimit"], PROFILE_ON_HOLD: ["profileLimit"], BRAND_SELLING_OFF: ["profileLimit"], STORE_LIMIT_ONE: ["profileLimit"], BUSINESS_PROFILE_LIMIT: ["profileLimit"],
  COUNTRY_REQUIRED: ["countryRequired"],
  PLAN_FEATURE_REQUIRED: ["planFeatureRequired"], PLAN_UPGRADE_REQUIRED: ["planFeatureRequired"], CREATOR_PROGRAM_REQUIRED: ["planFeatureRequired"], BLACK_ANNUAL_DISABLED: ["planFeatureRequired"], BLACK_DISCOUNTS_DISABLED: ["planFeatureRequired"],
  PRODUCT_LIMIT_REACHED: ["quotaReached"], ADDRESS_LIMIT_REACHED: ["quotaReached"], LOCATION_LIMIT_REACHED: ["quotaReached"], SEAT_LIMIT_REACHED: ["quotaReached"], MEMBER_LIMIT_REACHED: ["quotaReached"], SEGMENT_LIMIT_REACHED: ["quotaReached"], RULE_LIMIT_REACHED: ["quotaReached"], SCENE_LIMIT_REACHED: ["quotaReached"], PIN_LIMIT_REACHED: ["quotaReached"], CATEGORY_LIMIT_REACHED: ["quotaReached"], API_KEY_LIMIT_REACHED: ["quotaReached"], AREA_LIMIT_REACHED: ["quotaReached"], QUOTA_EXCEEDED: ["quotaReached"], SANDBOX_QUOTA_EXCEEDED: ["quotaReached"],
  FILE_TOO_LARGE: ["fileTooLarge"], PAYLOAD_TOO_LARGE: ["fileTooLarge"], BODY_TOO_LARGE: ["fileTooLarge"],
  UNSUPPORTED_MEDIA_TYPE: ["unsupportedFile"], MEDIA_TYPE_NOT_SUPPORTED: ["unsupportedFile"], UNSUPPORTED_POST_MEDIA: ["unsupportedFile"], UNSUPPORTED_STORY_MEDIA: ["unsupportedFile"],
  UPLOAD_FAILED: ["uploadFailed"], UPLOAD_INCOMPLETE: ["uploadFailed"], UPLOAD_MISSING: ["uploadFailed"], UPLOAD_SIZE_MISMATCH: ["uploadFailed"], UPLOAD_NOT_FOUND: ["uploadFailed"],
  ALREADY_PAID: ["alreadyDone"], ALREADY_SUBSCRIBED: ["alreadyDone"], ALREADY_VERIFIED: ["alreadyDone"], ALREADY_APPEALED: ["alreadyDone"], IDEMPOTENCY_KEY_REUSED: ["alreadyDone"], REQUEST_ALREADY_DECIDED: ["alreadyDone"], DUPLICATE: ["alreadyDone"],
  VERSION_CONFLICT: ["versionConflict"], CONFLICT: ["versionConflict"], STALE_POLICY_VERSION: ["versionConflict"], USERNAME_TAKEN: ["versionConflict"],
  CAMERA_PERMISSION_DENIED: ["permissionDenied", "camera"], MICROPHONE_PERMISSION_DENIED: ["permissionDenied", "microphone"], LOCATION_PERMISSION_DENIED: ["permissionDenied", "location"],
  EMBED_UNAVAILABLE: ["embedUnavailable"],
};

function kindFromStatus(status: number | undefined): ErrorKind {
  if (status === undefined) return "unknown";
  if (status === 0) return "offline";
  if (status === 401) return "signedOut";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 408 || status === 504) return "timeout";
  if (status === 409) return "versionConflict";
  if (status === 410) return "contentGone";
  if (status === 413) return "fileTooLarge";
  if (status === 415) return "unsupportedFile";
  if (status === 426) return "updateRequired";
  if (status === 429) return "rateLimited";
  if (status === 502 || status === 503) return "maintenance";
  if (status >= 500) return "serverError";
  return "unknown";
}

export function resolveErrorKind(signal: ErrorSignal): { readonly kind: ErrorKind; readonly subject?: ErrorSubject } {
  const code = signal.code?.toUpperCase();
  const rule = code ? errorKindByCode[code] : undefined;
  if (rule) return { kind: rule[0], subject: signal.subject ?? rule[1] };
  if (code === "HTTP_429" || code?.endsWith("_RATE_LIMITED")) return { kind: "rateLimited", subject: signal.subject };
  if (code?.endsWith("_TIMEOUT")) return { kind: "timeout", subject: signal.subject };
  if (code?.endsWith("_LIMIT_REACHED")) return { kind: "quotaReached", subject: signal.subject };
  return { kind: kindFromStatus(signal.status), subject: signal.subject };
}

export interface DescribeErrorOptions {
  readonly kind?: ErrorKind;
  readonly subject?: ErrorSubject;
  readonly describePermission?: (permissionKey: string) => string | undefined;
}

export function describeErrorSignal(signal: ErrorSignal, options: DescribeErrorOptions = {}): ErrorDescriptor {
  const resolved = options.kind ? { kind: options.kind, subject: options.subject ?? signal.subject } : resolveErrorKind({ ...signal, subject: options.subject ?? signal.subject });
  const permissionKey = typeof signal.details?.["permission"] === "string" ? (signal.details["permission"] as string) : undefined;
  const permissionLabel = permissionKey ? (options.describePermission?.(permissionKey) ?? permissionKey) : undefined;
  const entry = buildCatalogEntry(resolved.kind, { subject: resolved.subject, code: signal.code, details: signal.details, retryAfterSeconds: signal.retryAfterSeconds, permissionLabel });
  const reference = signal.requestId ?? signal.digest;
  return {
    ...entry,
    kind: resolved.kind,
    subject: resolved.subject,
    live: entry.live ?? "alert",
    ...(signal.code ? { code: signal.code } : {}),
    ...(reference ? { reference } : {}),
    ...(signal.retryAfterSeconds ? { retryAfterSeconds: signal.retryAfterSeconds } : {}),
  };
}
