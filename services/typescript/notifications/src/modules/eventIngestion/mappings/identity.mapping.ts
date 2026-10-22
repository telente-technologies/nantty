import { createDecipheriv } from "node:crypto";

import type { EventDataReader } from "../../../utils/eventDataReader.util.js";
import { formatBytes, intentFor, plan, type EventMapping, type MappingContext } from "./mappingHelpers.js";

const deviceDetails = (data: EventDataReader, occurredAt: string) => ({
  device: data.text("device", "Unknown device"), location: data.text("location", "Unknown location"), ipAddress: data.text("ipAddress", "Unknown"), occurredAt: data.text("occurredAt", occurredAt),
});

export const accountRegistered: EventMapping = (event, data) => [
  intentFor(event, data.text("accountId"), {
    category: "auth",
    inApp: { category: "system", title: "Welcome to Zudomart", body: "Buy from real sellers near you. Your money stays in escrow until you confirm delivery." },
    email: (recipient) => plan("welcome", { firstName: recipient.firstName, username: data.text("username") }),
  }),
];

export function openSealedOtpCode(sealedBase64: string, key: Buffer): string | null {
  const sealed = Buffer.from(sealedBase64, "base64");
  if (sealed.length < 12 + 16) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, sealed.subarray(0, 12));
    decipher.setAuthTag(sealed.subarray(sealed.length - 16));
    return Buffer.concat([decipher.update(sealed.subarray(12, sealed.length - 16)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const otpIssued: EventMapping = (event, data, context) => {
  const key = context.otpEnvelopeKeys?.[data.text("keyId")];
  const expiresAt = Date.parse(data.text("expiresAt"));
  const code = key === undefined || !(expiresAt > Date.now()) ? null : openSealedOtpCode(data.text("codeSealed"), key);
  if (code === null) return [];
  const accountId = data.optionalText("accountId") ?? `otp:${data.text("destination")}`;
  return [
    intentFor(event, accountId, {
      category: "auth",
      emailAddressOverride: data.text("destination"),
      email: (recipient) => plan("emailOtp", { firstName: recipient.firstName, code, expiresInMinutes: data.integer("expiresInMinutes", 5), purpose: data.text("purpose") }),
    }),
  ];
};

export const passwordChanged: EventMapping = (event, data) => [
  intentFor(event, data.text("accountId"), {
    category: "auth",
    inApp: { category: "system", title: "Your password was changed", body: "If this was not you, reset your password and contact support." },
    email: (recipient) => plan("passwordChanged", { firstName: recipient.firstName, ...deviceDetails(data, event.occurredAt) }),
  }),
];

export const sessionRevoked: EventMapping = (event, data) =>
  data.text("reason") !== "revoke_all" ? [] : [
    intentFor(event, data.text("accountId"), {
      category: "auth",
      inApp: { category: "system", title: "You were signed out everywhere", body: "All of your sessions were ended." },
      email: (recipient) => plan("sessionsRevoked", { firstName: recipient.firstName, sessionCount: data.integer("sessionCount", 1), initiatedBy: "you", occurredAt: event.occurredAt }),
    }),
  ];

export const refreshTokenReuseDetected: EventMapping = (event, data) => [
  intentFor(event, data.text("accountId"), {
    category: "auth",
    inApp: { category: "system", title: "We signed you out for your safety", body: "We saw suspicious activity on your session. Sign in again and change your password." },
    email: (recipient) => plan("sessionsRevoked", { firstName: recipient.firstName, sessionCount: data.integer("sessionCount", 1), initiatedBy: "zudomart", occurredAt: event.occurredAt }),
  }),
];

export const newSignInDetected: EventMapping = (event, data, context) => [
  intentFor(event, data.text("accountId"), {
    category: "auth",
    inApp: { category: "system", title: "New sign-in to your account", body: `${data.text("device", "A new device")} signed in from ${data.text("location", "an unknown location")}.` },
    push: { title: "New sign-in", body: "Was this you? Review your account activity." },
    email: (recipient) => plan("newSignIn", { firstName: recipient.firstName, ...deviceDetails(data, event.occurredAt), reviewUrl: data.text("reviewUrl", `${context.webBaseUrl}/settings/security`) }),
  }),
];

export const twoFactorEnabled: EventMapping = (event, data) => [
  intentFor(event, data.text("accountId"), {
    category: "auth",
    inApp: { category: "system", title: "Two-factor sign-in turned on", body: "Your account is better protected." },
    email: (recipient) => plan("twoFactorEnabled", { firstName: recipient.firstName, method: data.text("method"), occurredAt: event.occurredAt }),
  }),
];

const actionProps = (data: EventDataReader, firstName: string) => ({
  firstName, caseId: data.text("caseId"), reason: data.text("reason"), policy: data.text("policy"), policyUrl: data.text("policyUrl"), appealUrl: data.text("appealUrl"),
});

const accountStatusLink = (context: MappingContext) => ({
  url: `${context.webBaseUrl}/settings/account-status`,
  screen: "AccountStatus",
});

export const accountRestricted: EventMapping = (event, data, context) => [
  intentFor(event, data.text("accountId"), {
    category: "trust",
    inApp: { category: "system", title: "Your account has been restricted", body: data.text("reason", "Some features are limited. Open the email for details and how to appeal."), data: accountStatusLink(context) },
    push: { title: "Account restricted", body: "Open the app for details." },
    email: (recipient) => plan("accountRestricted", { ...actionProps(data, recipient.firstName), restrictions: data.textList("restrictions"), until: data.text("until") }),
  }),
];

export const accountWarned: EventMapping = (event, data, context) => [
  intentFor(event, data.text("accountId"), {
    category: "trust",
    inApp: { category: "system", title: "You received a warning", body: data.text("reason", "Something you shared went against our Community Guidelines."), data: accountStatusLink(context) },
    push: { title: "Community Guidelines warning", body: "Open the app to see what happened." },
  }),
];

export const accountSuspended: EventMapping = (event, data, context) => [
  intentFor(event, data.text("accountId"), {
    category: "trust",
    inApp: { category: "system", title: "Your account has been suspended", body: data.text("reason", "Open the email for details and how to appeal."), data: accountStatusLink(context) },
    email: (recipient) => plan("accountSuspended", { ...actionProps(data, recipient.firstName), appealBy: data.text("appealBy"), deletionAt: data.text("deletionAt") }),
  }),
];

export const accountBanned: EventMapping = (event, data, context) => [
  intentFor(event, data.text("accountId"), {
    category: "trust",
    inApp: { category: "system", title: "Your account has been banned", body: data.text("reason", "Open the email for details and how to appeal."), data: accountStatusLink(context) },
    email: (recipient) => plan("accountBanned", actionProps(data, recipient.firstName)),
  }),
];

export const appealDecided: EventMapping = (event, data, context) => [
  intentFor(event, data.text("accountId"), {
    category: "trust",
    inApp: { category: "system", title: "Your appeal has been decided", body: data.text("explanation"), data: accountStatusLink(context) },
    email: (recipient) => plan("appealDecision", { firstName: recipient.firstName, caseId: data.text("caseId"), outcome: data.text("outcome") === "overturned" ? "overturned" : "upheld", explanation: data.text("explanation") }),
  }),
];

export const reportClosed: EventMapping = (event, data) => [
  intentFor(event, data.text("reporterUserId"), {
    category: "trust",
    inApp: { category: "system", title: "Your report was reviewed", body: "Thanks for helping keep Zudomart safe. Open the email for the outcome." },
    email: (recipient) => plan("reportOutcome", { firstName: recipient.firstName, reportId: data.text("reportId"), reportedWhat: data.text("reportedWhat"), outcome: data.text("outcome") === "action_taken" ? "action_taken" : "no_violation", reportedAt: data.text("reportedAt") }),
  }),
];

export const dataExportCompleted: EventMapping = (event, data, context) => [
  intentFor(event, data.text("accountId"), {
    category: "privacy",
    inApp: { category: "system", title: "Your data export is ready", body: "Download it before the link expires." },
    email: (recipient) => plan("dataExportReady", {
      firstName: recipient.firstName, downloadUrl: data.text("downloadUrl", `${context.webBaseUrl}/privacy/exports/${data.text("exportId")}`), expiresAt: data.text("expiresAt"),
      sizeLabel: formatBytes(data.integer("sizeBytes")), requestedAt: data.text("requestedAt", data.text("completedAt")),
    }),
  }),
];

export const deletionRequested: EventMapping = (event, data, context) => [
  intentFor(event, data.text("accountId"), {
    category: "privacy",
    inApp: { category: "system", title: "Account deletion scheduled", body: "You can cancel any time before the deletion date." },
    email: (recipient) => plan("accountDeletionScheduled", { firstName: recipient.firstName, deleteAt: data.text("scheduledFor"), cancelUrl: data.text("cancelUrl", `${context.webBaseUrl}/settings/account/deletion/cancel`), openOrders: data.integer("openOrders", 0) }),
  }),
];

export const deletionExecuted: EventMapping = (event, data) => {
  const finalAddress = data.optionalText("finalEmail");
  if (finalAddress === undefined) return [];
  return [
    intentFor(event, data.text("accountId"), {
      category: "privacy",
      emailAddressOverride: finalAddress,
      email: (recipient) => plan("accountDeletionCompleted", { firstName: recipient.firstName, deletedAt: data.text("executedAt"), referenceId: data.text("referenceId", data.text("accountId")) }),
    }),
  ];
};
