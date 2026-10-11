import { contentAndCommerceCatalog } from "./errorCatalog.content";
import type { CatalogContext, CatalogEntry } from "./errorCatalog.types";
import type { ErrorKind } from "./errorKinds";
import { formatWaitDuration } from "./retryCountdown";

function readText(details: CatalogContext["details"], key: string): string | null {
  const value = details?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function describeMaintenance(context: CatalogContext): string {
  const message = readText(context.details, "maintenanceMessage");
  const endsAt = readText(context.details, "maintenanceEndsAt") ?? readText(context.details, "endsAt");
  if (message) return message;
  if (endsAt && !Number.isNaN(Date.parse(endsAt))) {
    const time = new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit" }).format(new Date(endsAt));
    return `We're doing planned maintenance and expect to be back by ${time}. Your account and money are safe.`;
  }
  return "We're fixing something on our side. Your account and money are safe. Try again in a few minutes.";
}

const systemAndAccessCatalog: Partial<Record<ErrorKind, (context: CatalogContext) => CatalogEntry>> = {
  unknown: () => ({ title: "That didn't work", description: "Something unexpected stopped this from loading. Try again, and if it keeps happening, share the reference below with support.", icon: "warning", tone: "caution", motion: "breathe", primary: "retry", secondary: "home" }),
  offline: () => ({ title: "You're offline", description: "Check your data or Wi-Fi. We'll reload this as soon as you're back online.", icon: "wifiSlash", tone: "neutral", motion: "breathe", primary: "checkAgain", live: "status" }),
  timeout: () => ({ title: "This is taking too long", description: "Your connection looks slow. Move closer to your Wi-Fi or switch networks, then try again.", icon: "hourglass", tone: "caution", motion: "breathe", primary: "retry" }),
  serverError: () => ({ title: "Something broke on our side", description: "It's not you. We've been alerted. Try again in a moment, and nothing you saved is lost.", icon: "bug", tone: "danger", motion: "glitch", hero: "500", primary: "retry", secondary: "home" }),
  maintenance: (context) => ({ title: "We'll be right back", description: describeMaintenance(context), icon: "wrench", tone: "caution", motion: "breathe", primary: "retry" }),
  rateLimited: (context) => ({
    title: "Slow down a little",
    description: context.retryAfterSeconds ? `You've made a lot of requests in a short time. You can try again in ${formatWaitDuration(context.retryAfterSeconds)}.` : "You've made a lot of requests in a short time. Wait a moment, then try again.",
    icon: "gauge", tone: "caution", motion: "breathe", primary: "retry",
  }),
  tooManyAttempts: (context) => ({
    title: "Sign-in is paused",
    description: context.retryAfterSeconds ? `Too many attempts. To protect your account, you can try again in ${formatWaitDuration(context.retryAfterSeconds)}, or reset your password.` : "Too many attempts. To protect your account, wait a few minutes before trying again, or reset your password.",
    icon: "lockKey", tone: "danger", motion: "breathe", primary: "retry", secondary: "support",
  }),
  updateRequired: () => ({ title: "Update Zudomart to continue", description: "This version of the app is no longer supported. Update to get the latest fixes and keep your account secure.", icon: "arrowCircleUp", tone: "brand", motion: "float", primary: "update" }),
  unsupportedBrowser: (context) => ({
    title: context.subject === "live" ? "Live video can't play on this device" : "This device isn't supported",
    description: context.subject === "live" ? "Update Zudomart and your phone's software to watch lives here." : "Update Zudomart and your phone's software to keep using this feature.",
    icon: "browser", tone: "neutral", motion: "float", primary: "update",
  }),
  storageDisabled: () => ({ title: "Turn on cookies to continue", description: "Your browser is blocking cookies or site storage, so we can't keep you signed in. Allow them for Zudomart, then reload.", icon: "cookie", tone: "caution", motion: "float", primary: "reload" }),
  clockSkew: () => ({ title: "Your device time looks wrong", description: "Secure sign-in fails when the clock is off. Turn on automatic date and time in your phone settings, then try again.", icon: "clock", tone: "caution", motion: "breathe", primary: "retry", secondary: "openSettings" }),
  securityCheckFailed: () => ({ title: "We couldn't confirm you're human", description: "The security check didn't go through. Reload the page and try again. A VPN or ad blocker can sometimes cause this.", icon: "robot", tone: "caution", motion: "breathe", primary: "reload" }),
  notFound: () => ({ title: "This page wandered off", description: "The link may be broken, or the page may have moved. Let's get you somewhere useful.", icon: "mapTrifold", tone: "brand", motion: "float", hero: "404", primary: "home", secondary: "back" }),
  linkExpired: () => ({ title: "This link has expired", description: "For your safety, links like this only work for a short time or once. Request a fresh one and use it straight away.", icon: "linkBreak", tone: "caution", motion: "breathe", primary: "home" }),
  inviteInvalid: (context) => ({
    title: context.details?.["reason"] === "used" ? "This invite was already used" : "This invite isn't valid anymore",
    description: "It may have been used, revoked, or sent to a different email. Ask the person who invited you to send a new one.",
    icon: "envelopeOpen", tone: "neutral", motion: "float", primary: "home",
  }),
  signedOut: () => ({ title: "Sign in to continue", description: "You need to be signed in to see this. Anything you were doing will pick up where you left off.", icon: "signIn", tone: "brand", motion: "float", primary: "signIn", secondary: "home" }),
  sessionExpired: () => ({ title: "Your session has ended", description: "For your security, you were signed out. Sign in again to carry on.", icon: "signIn", tone: "brand", motion: "float", primary: "signIn" }),
  forbidden: (context) => ({
    title: "You don't have access to this",
    description: context.permissionLabel ? `You don't have the "${context.permissionLabel}" permission. Ask an owner or superadmin to grant it.` : "Your account or role doesn't include this. If you think that's wrong, ask the owner of this space for access.",
    icon: "shieldWarning", tone: "caution", motion: "breathe", hero: "403", primary: "home", secondary: "back",
  }),
  stepUpRequired: () => ({ title: "Confirm it's you", description: "This is a sensitive action, so we need a quick check before we continue.", icon: "shieldCheck", tone: "brand", motion: "breathe", primary: "stepUp" }),
  verificationRequired: () => ({ title: "Verify your identity first", description: "This needs a verified account. It takes a few minutes, and your documents stay private.", icon: "sealCheck", tone: "brand", motion: "float", primary: "verify" }),
  emailNotVerified: () => ({ title: "Confirm your email", description: "We sent a link to your inbox. Open it to finish setting up, or we can send another one.", icon: "envelope", tone: "brand", motion: "float", primary: "resendEmail" }),
  accountSuspended: (context) => ({
    title: "Your account is suspended",
    description: context.details?.["reason"] === "copyright" || context.code === "COPYRIGHT"
      ? "This follows a second copyright strike within 12 months. Posting, going live, selling and earning are paused for at least 30 days. You can appeal from Account status."
      : "Some or all of your account is paused because of a rules breach. See what happened and how to appeal on your Account status page.",
    icon: "userMinus", tone: "danger", motion: "breathe", primary: "accountStatus", secondary: "appeal",
  }),
  accountRestricted: () => ({ title: "This feature is restricted", description: "Your account has a temporary limit on this. It lifts automatically, and you can see details or appeal on your Account status page.", icon: "warning", tone: "caution", motion: "breathe", primary: "accountStatus" }),
  permissionDenied: (context) => {
    const subject = context.subject === "microphone" ? "microphone" : context.subject === "location" ? "location" : "camera";
    const reason = subject === "microphone" ? "record audio and go live" : subject === "location" ? "find delivery options and nearby stores" : "take photos, scan and go live";
    return { title: `Allow ${subject} access`, description: `Zudomart needs your ${subject} to ${reason}. Turn it on in your settings, then come back.`, icon: subject === "microphone" ? "microphone" : subject === "location" ? "mapPin" : "camera", tone: "neutral", motion: "float", primary: "openSettings" };
  },
  embedUnavailable: () => ({ title: "This store isn't available", description: "It may have moved or been closed. Visit Zudomart to keep shopping.", icon: "storefront", tone: "neutral", motion: "float", primary: "home" }),
  planFeatureRequired: (context) => {
    const plan = readText(context.details, "requiredPlan") ?? readText(context.details, "plan");
    return { title: plan ? `Available on ${plan}` : "Not included in your plan", description: "Upgrade your seller plan to unlock this. You can change or cancel your plan any time.", icon: "crown", tone: "brand", motion: "float", primary: "upgrade", secondary: "back" };
  },
  quotaReached: (context) => {
    const limit = context.details?.["limit"];
    const limitText = typeof limit === "number" ? ` of ${limit.toLocaleString("en-NG")}` : "";
    return { title: "You've reached your limit", description: `You've used the full allowance${limitText} on your current plan. Remove something you no longer need, or upgrade for more room.`, icon: "database", tone: "caution", motion: "breathe", primary: "upgrade", secondary: "back" };
  },
  fileTooLarge: (context) => {
    const maximumBytes = context.details?.["maxBytes"];
    const limit = typeof maximumBytes === "number" ? ` The limit is ${Math.round(maximumBytes / (1024 * 1024))} MB.` : "";
    return { title: "That file is too large", description: `Choose a smaller file or compress it first.${limit}`, icon: "fileX", tone: "caution", motion: "breathe", primary: "chooseFile" };
  },
  unsupportedFile: () => ({ title: "That file type isn't supported", description: "Use a JPG, PNG or WebP image, or an MP4 or MOV video.", icon: "fileX", tone: "caution", motion: "breathe", primary: "chooseFile" }),
  uploadFailed: () => ({ title: "Upload didn't finish", description: "The connection dropped before your file was saved. Try again on a steadier network.", icon: "uploadSimple", tone: "caution", motion: "glitch", primary: "retry" }),
  alreadyDone: () => ({ title: "This was already done", description: "We received this earlier, so nothing was repeated. Reload to see the latest.", icon: "checkCircle", tone: "success", motion: "float", primary: "reload" }),
  versionConflict: () => ({ title: "This changed while you were here", description: "Someone else updated this first. Reload to see the latest version, then make your change again.", icon: "arrowsClockwise", tone: "caution", motion: "breathe", primary: "reload" }),
};

const catalog = { ...systemAndAccessCatalog, ...contentAndCommerceCatalog };

export function buildCatalogEntry(kind: ErrorKind, context: CatalogContext): CatalogEntry {
  return (catalog[kind] ?? catalog.unknown!)(context);
}
