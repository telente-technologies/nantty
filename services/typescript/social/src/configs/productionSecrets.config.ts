const secretVariablePattern = /(_TOKEN|_SECRET|_SECRETS|_URL)$/;
const placeholderPattern = /local[-_]only|change[-_]?me/i;

export function collectPlaceholderSecretProblems(environment: NodeJS.ProcessEnv): string[] {
  if (environment["NODE_ENV"] !== "production") return [];
  return Object.entries(environment)
    .filter(([name, value]) => secretVariablePattern.test(name) && value !== undefined && placeholderPattern.test(value))
    .map(([name]) => `${name} must not use a local-only placeholder value in production`);
}
