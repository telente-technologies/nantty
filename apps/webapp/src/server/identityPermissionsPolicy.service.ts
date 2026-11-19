const smileCaptureOrigins = [
  "https://links.usesmileid.com",
  "https://links.sandbox.usesmileid.com",
  "https://links.dev.usesmileid.com",
] as const;

export function buildIdentityPermissionsPolicyHeaderValue(): string {
  const cameraOrigins = ["self", ...smileCaptureOrigins.map((origin) => `"${origin}"`)];
  return `camera=(${cameraOrigins.join(" ")}), microphone=(), geolocation=(), payment=()`;
}
