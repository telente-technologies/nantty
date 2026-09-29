import { unprocessable } from "../../../errors/domain.error.js";

export interface ContactAddress {
  readonly kind: "email" | "phone";
  readonly value: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTERNATIONAL_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

export function normalizeEmailAddress(email: string): string {
  return email.normalize("NFKC").trim().toLowerCase();
}

export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/[\s()-]/g, "");
  if (/^0\d{10}$/.test(digits)) return `+234${digits.slice(1)}`;
  if (/^234\d{10}$/.test(digits)) return `+${digits}`;
  return digits;
}

export function parseContactAddress(input: string): ContactAddress {
  const trimmed = input.trim();
  if (trimmed.includes("@")) {
    const email = normalizeEmailAddress(trimmed);
    if (!EMAIL_PATTERN.test(email)) throw unprocessable("Enter a valid email address.");
    return { kind: "email", value: email };
  }
  const phone = normalizePhoneNumber(trimmed);
  if (!INTERNATIONAL_PHONE_PATTERN.test(phone)) throw unprocessable("Enter a valid phone number.");
  return { kind: "phone", value: phone };
}

export function normalizeUsername(username: string): string {
  return username.normalize("NFKC").trim().toLowerCase();
}

export function convertRequestedPurposeToOtpPurpose(purpose: "signup" | "reset" | "login"): "signup" | "reset_password" | "login" {
  return purpose === "reset" ? "reset_password" : purpose;
}
