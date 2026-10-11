const placeholderSecretPatterns: readonly RegExp[] = [/^local-only/i, /change[-_]?me/i, /^example/i, /placeholder/i, /^test[-_]/i];
const minimumSecretLength = 32;
const guardedSecretNames = ["GATEWAY_IDENTITY_SECRET", "IDENTITY_INTERNAL_TOKEN", "TRUST_INTERNAL_TOKEN"] as const;

export function isPlaceholderSecret(value: string): boolean {
  return placeholderSecretPatterns.some((pattern) => pattern.test(value));
}

export function collectProductionHardeningProblems(environment: NodeJS.ProcessEnv): string[] {
  if (environment["NODE_ENV"] !== "production") return [];
  const problems: string[] = [];
  if ((environment["TRUSTED_PROXY_HOPS"]?.trim() ?? "") === "") problems.push("TRUSTED_PROXY_HOPS must be set explicitly in production (the number of proxies in front of the gateway)");
  for (const name of guardedSecretNames) {
    const value = environment[name]?.trim() ?? "";
    if (value === "") continue;
    if (isPlaceholderSecret(value)) problems.push(`${name} must not be a placeholder value in production`);
    else if (value.length < minimumSecretLength) problems.push(`${name} must be at least ${minimumSecretLength} characters in production`);
  }
  return problems;
}
