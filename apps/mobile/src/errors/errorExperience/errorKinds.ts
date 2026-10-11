// Mirrors packages/webKit/src/errorExperience; keep kinds, codes and copy in sync.
export const errorKinds = [
  "unknown", "offline", "timeout", "serverError", "maintenance", "rateLimited", "tooManyAttempts", "updateRequired", "unsupportedBrowser", "storageDisabled", "clockSkew", "securityCheckFailed",
  "notFound", "linkExpired", "inviteInvalid",
  "signedOut", "sessionExpired", "forbidden", "stepUpRequired", "verificationRequired", "emailNotVerified",
  "accountSuspended", "accountRestricted",
  "contentGone", "contentPrivate", "contentBlocked", "contentRemoved", "sensitiveContent", "mediaFailed", "decryptionFailed", "liveUnavailable",
  "orderNotFound", "storeClosed", "outOfStock", "regionUnavailable", "deliveryUnavailable", "checkoutExpired", "cartChanged",
  "paymentFailed", "paymentPending", "paymentLimit", "sellerDebtLimit", "countryRequired",
  "planFeatureRequired", "quotaReached",
  "fileTooLarge", "unsupportedFile", "uploadFailed",
  "alreadyDone", "versionConflict",
  "permissionDenied", "embedUnavailable",
] as const;

export type ErrorKind = (typeof errorKinds)[number];

export type ErrorSubject = "post" | "product" | "store" | "profile" | "live" | "clip" | "story" | "order" | "comment" | "camera" | "microphone" | "location" | "image" | "video";

export type ErrorTone = "brand" | "danger" | "caution" | "neutral" | "success";

export type ErrorMotion = "float" | "glitch" | "breathe";

export const errorActionIntents = [
  "retry", "reload", "home", "back", "search", "signIn", "verify", "stepUp", "openSettings", "accountStatus", "appeal", "support", "update", "upgrade",
  "resendEmail", "chooseCountry", "payByCard", "viewCart", "showAnyway", "checkAgain", "browse", "viewOrders", "changeAddress", "chooseFile", "useApp", "clearDebt",
] as const;

export type ErrorActionIntent = (typeof errorActionIntents)[number];

export const errorIconNames = [
  "warning", "bug", "wifiSlash", "cloudSlash", "hourglass", "timer", "magnifyingGlass", "mapTrifold", "trash", "ghost", "lockKey", "prohibit", "signIn", "shieldWarning", "shieldCheck",
  "sealCheck", "gauge", "wrench", "creditCard", "wallet", "globe", "userMinus", "arrowCircleUp", "camera", "microphone", "mapPin", "imageBroken", "filmSlash", "videoCameraSlash",
  "linkBreak", "envelope", "envelopeOpen", "copyright", "eyeSlash", "receipt", "storefront", "package", "truck", "shoppingCart", "clockCounterClockwise", "crown", "database", "fileX",
  "uploadSimple", "checkCircle", "arrowsClockwise", "browser", "cookie", "clock", "robot", "codeBlock", "question", "chatsCircle", "magnifyingGlassMinus", "bell", "receiptX", "squaresFour",
  "playCircle", "chartLine", "megaphone", "users", "house", "compass", "broadcast",
] as const;

export type ErrorIconName = (typeof errorIconNames)[number];

export interface ErrorSignal {
  readonly status?: number;
  readonly code?: string;
  readonly details?: Readonly<Record<string, unknown>> | null;
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;
  readonly digest?: string;
  readonly subject?: ErrorSubject;
}

export interface ErrorDescriptor {
  readonly kind: ErrorKind;
  readonly title: string;
  readonly description: string;
  readonly icon: ErrorIconName;
  readonly tone: ErrorTone;
  readonly motion: ErrorMotion;
  readonly hero?: string;
  readonly primary?: ErrorActionIntent;
  readonly secondary?: ErrorActionIntent;
  readonly retryAfterSeconds?: number;
  readonly code?: string;
  readonly reference?: string;
  readonly subject?: ErrorSubject;
  readonly live: "alert" | "status";
}

export const defaultActionLabels: Readonly<Record<ErrorActionIntent, string>> = {
  retry: "Try again",
  reload: "Reload page",
  home: "Go home",
  back: "Go back",
  search: "Search",
  signIn: "Sign in",
  verify: "Verify now",
  stepUp: "Confirm it's you",
  openSettings: "Open settings",
  accountStatus: "View account status",
  appeal: "Appeal this decision",
  support: "Contact support",
  update: "Update the app",
  upgrade: "See plans",
  resendEmail: "Resend email",
  chooseCountry: "Choose your country",
  payByCard: "Pay by card",
  viewCart: "Review your cart",
  showAnyway: "Show anyway",
  checkAgain: "Check again",
  browse: "Keep exploring",
  viewOrders: "View your orders",
  changeAddress: "Change address",
  chooseFile: "Choose another file",
  useApp: "Open in the app",
  clearDebt: "Settle balance",
};
