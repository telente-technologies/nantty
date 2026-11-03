export function platformIdentityLabelFor(platform: string): string | null {
  if (platform === "ios") return "Nantty for iPhone";
  if (platform === "android") return "Nantty for Android";
  return null;
}
