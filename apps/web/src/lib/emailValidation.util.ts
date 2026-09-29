const maximumEmailLength = 254;
const emailAddressPattern = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;

export function normalizeEmailAddress(rawEmailAddress: string): string {
  return rawEmailAddress.trim().toLowerCase();
}

export function validateEmailAddressFormat(rawEmailAddress: string): string | null {
  const emailAddress = normalizeEmailAddress(rawEmailAddress);
  if (emailAddress.length === 0) return "Enter your email address.";
  if (emailAddress.length > maximumEmailLength) return "That email address is too long.";
  if (!emailAddressPattern.test(emailAddress)) return "Enter an email address like name@example.com.";
  return null;
}
