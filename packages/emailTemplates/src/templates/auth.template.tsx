import type { RecipientProps } from "../emailTypes";
import { sampleDevice } from "../samples/sampleData";
import { consentRules, defineEmailTemplate } from "./defineTemplate";

interface DeviceProps extends RecipientProps {
  readonly device: string;
  readonly location: string;
  readonly ipAddress: string;
  readonly occurredAt: string;
}

const deviceRows = (props: DeviceProps, when: string) => [
  { label: "When", value: when },
  { label: "Device", value: props.device },
  { label: "Location", value: props.location },
  { label: "IP address", value: props.ipAddress, mono: true },
];

const notYou = (url: string) => ({ type: "callout" as const, tone: "danger" as const, title: "Wasn't you?", text: ["Secure your account now. ", { link: "Reset your password and sign out everywhere", href: url }, "."] });

export const emailOtp = defineEmailTemplate<RecipientProps & { readonly code: string; readonly expiresInMinutes: number; readonly purpose: string }>({
  key: "emailOtp", name: "Email one-time code", category: "auth", kind: "security", audience: "Any user", trigger: "auth.otp.requested", consent: consentRules.security,
  subject: (p) => `${p.code} is your Nantty code`,
  preheader: (p) => `Use it to ${p.purpose}. It expires in ${p.expiresInMinutes} minutes.`,
  blocks: (p) => [
    { type: "hero", eyebrow: "Verification code", title: `Here's your code to ${p.purpose}` },
    { type: "code", code: p.code, caption: `Expires in ${p.expiresInMinutes} minutes · Use it once` },
    { type: "paragraph", text: "Enter this code in the Nantty app or on the website. Never share it with anyone — Nantty staff will never ask for it, not even on a call or in chat." },
    { type: "paragraph", muted: true, text: "Didn't ask for a code? Someone may have typed your email by mistake. You can ignore this email; nobody can get in without the code." },
  ],
  sample: { firstName: "Amaka", code: "482913", expiresInMinutes: 10, purpose: "sign in" },
});

export const welcome = defineEmailTemplate<RecipientProps & { readonly username: string }>({
  key: "welcome", name: "Welcome", category: "auth", kind: "transactional", audience: "New user", trigger: "identity.account.created", consent: consentRules.always,
  subject: (p) => `Welcome to Nantty, ${p.firstName}`,
  preheader: () => "Shop from verified sellers, pay safely through escrow, and catch live drops.",
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Welcome", title: `You're in, @${p.username}` },
    { type: "paragraph", text: `Hi ${p.firstName}, welcome to Nantty — a marketplace where every payment is held safely in escrow until your order arrives.` },
    { type: "list", title: "Three things worth doing first", items: [
      [{ strong: "Follow sellers you love" }, " — their drops and lives show up first in your feed."],
      [{ strong: "Add a delivery address" }, " — checkout takes seconds after that."],
      [{ strong: "Turn on two-step verification" }, " — it keeps your wallet and orders safe."],
    ] },
    { type: "button", label: "Start exploring", href: c.url("/") },
    { type: "links", items: [{ label: "How escrow protects you", href: c.url("/help/escrow") }, { label: "Become a seller", href: c.url("/sell") }] },
  ],
  sample: { firstName: "Amaka", username: "amaka.styles" },
});

export const verifyEmail = defineEmailTemplate<RecipientProps & { readonly verifyUrl: string; readonly expiresInHours: number }>({
  key: "verifyEmail", name: "Verify email address", category: "auth", kind: "security", audience: "Any user", trigger: "identity.email.verification_requested", consent: consentRules.security,
  subject: () => "Confirm your email address",
  preheader: (p) => `One tap to confirm. The link works for ${p.expiresInHours} hours.`,
  blocks: (p) => [
    { type: "hero", eyebrow: "Confirm email", title: "Is this your email address?" },
    { type: "paragraph", text: `Hi ${p.firstName}, tap the button to confirm this address. We'll use it for receipts, order updates and security alerts.` },
    { type: "button", label: "Confirm email address", href: p.verifyUrl },
    { type: "paragraph", muted: true, text: `The link expires in ${p.expiresInHours} hours. If you didn't create a Nantty account, ignore this email and the address won't be added.` },
  ],
  sample: { firstName: "Amaka", verifyUrl: "https://nantty.com/verify-email?token=sample", expiresInHours: 24 },
});

export const passwordReset = defineEmailTemplate<RecipientProps & { readonly resetUrl: string; readonly expiresInMinutes: number } & Omit<DeviceProps, "firstName">>({
  key: "passwordReset", name: "Password reset", category: "auth", kind: "security", audience: "Any user", trigger: "identity.password.reset_requested", consent: consentRules.security,
  subject: () => "Reset your Nantty password",
  preheader: (p) => `This link expires in ${p.expiresInMinutes} minutes.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Password reset", title: "Reset your password" },
    { type: "paragraph", text: `Hi ${p.firstName}, we got a request to reset your password. Tap below to choose a new one.` },
    { type: "button", label: "Choose a new password", href: p.resetUrl },
    { type: "details", title: "Request details", rows: deviceRows({ ...p }, c.dateTime(p.occurredAt)) },
    { type: "paragraph", muted: true, text: `The link expires in ${p.expiresInMinutes} minutes and works once. Didn't ask for this? Ignore this email — your password stays the same.` },
  ],
  sample: { firstName: "Amaka", resetUrl: "https://nantty.com/reset-password?token=sample", expiresInMinutes: 30, ...sampleDevice },
});

export const passwordChanged = defineEmailTemplate<DeviceProps>({
  key: "passwordChanged", name: "Password changed", category: "auth", kind: "security", audience: "Any user", trigger: "identity.password.changed", consent: consentRules.security,
  subject: () => "Your Nantty password was changed",
  preheader: () => "If this was you, there's nothing else to do.",
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Security", title: "Your password was changed", tone: "success" },
    { type: "paragraph", text: `Hi ${p.firstName}, the password on your account was just changed. For your safety, we signed out your other devices.` },
    { type: "details", rows: deviceRows(p, c.dateTime(p.occurredAt)) },
    notYou(c.url("/account/recover")),
  ],
  sample: { firstName: "Amaka", ...sampleDevice },
});

export const newSignIn = defineEmailTemplate<DeviceProps & { readonly reviewUrl: string }>({
  key: "newSignIn", name: "New sign-in or device", category: "auth", kind: "security", audience: "Any user", trigger: "identity.session.new_device", consent: consentRules.security,
  subject: (p) => `New sign-in on ${p.device.split(" · ")[0]}`,
  preheader: (p) => `${p.location}. Not you? Secure your account.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "New sign-in", title: "Was this you?", tone: "warn" },
    { type: "paragraph", text: `Hi ${p.firstName}, your account was just used to sign in on a device we haven't seen before.` },
    { type: "details", rows: deviceRows(p, c.dateTime(p.occurredAt)) },
    { type: "button", label: "Review your devices", href: p.reviewUrl },
    notYou(c.url("/account/recover")),
  ],
  sample: { firstName: "Amaka", reviewUrl: "https://nantty.com/settings/security/sessions", ...sampleDevice },
});

export const sessionsRevoked = defineEmailTemplate<RecipientProps & { readonly sessionCount: number; readonly initiatedBy: "you" | "nantty"; readonly occurredAt: string }>({
  key: "sessionsRevoked", name: "Sessions revoked", category: "auth", kind: "security", audience: "Any user", trigger: "identity.sessions.revoked", consent: consentRules.security,
  subject: (p) => `You were signed out of ${p.sessionCount} devices`,
  preheader: () => "Sign in again on the devices you still use.",
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Security", title: `Signed out of ${p.sessionCount} devices` },
    { type: "paragraph", text: p.initiatedBy === "you"
      ? `Hi ${p.firstName}, as you asked, we signed you out everywhere except the device you used on ${c.dateTime(p.occurredAt)}.`
      : `Hi ${p.firstName}, we noticed unusual activity and signed you out of every device on ${c.dateTime(p.occurredAt)} to keep your account safe.` },
    { type: "paragraph", text: "Sign in again on the devices you still use. Your orders, wallet and saved items are untouched." },
    { type: "button", label: "Check your security settings", href: c.url("/settings/security") },
  ],
  sample: { firstName: "Amaka", sessionCount: 4, initiatedBy: "you", occurredAt: sampleDevice.occurredAt },
});

export const twoFactorEnabled = defineEmailTemplate<RecipientProps & { readonly method: string; readonly occurredAt: string }>({
  key: "twoFactorEnabled", name: "Two-step verification on", category: "auth", kind: "security", audience: "Any user", trigger: "identity.mfa.enabled", consent: consentRules.security,
  subject: () => "Two-step verification is on",
  preheader: (p) => `You'll confirm new sign-ins with ${p.method}.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Security", title: "Two-step verification is on", tone: "success" },
    { type: "paragraph", text: [`Hi ${p.firstName}, from now on we'll ask for a code from `, { strong: p.method }, " whenever you sign in on a new device."] },
    { type: "callout", tone: "brand", title: "Save your recovery codes", text: "Keep them somewhere safe and offline. They're the only way back in if you lose your phone." },
    { type: "button", label: "View recovery codes", href: c.url("/settings/security/recovery-codes") },
    notYou(c.url("/account/recover")),
  ],
  sample: { firstName: "Amaka", method: "your authenticator app", occurredAt: sampleDevice.occurredAt },
});
