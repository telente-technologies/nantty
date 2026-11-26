export const businessMessagingScopeDescriptions = {
  "messages:send": "Send messages to customers who have consented to this business conversation.",
  "messages:read": "Read messages covered by the business messaging consent rules.",
  "conversations:read": "View conversations associated with this store.",
} as const;

export type BusinessMessagingScope = keyof typeof businessMessagingScopeDescriptions;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface BusinessMessagingAuthorizationRequest {
  readonly redirectUri: string;
  readonly codeChallenge: string;
  readonly codeChallengeMethod: "S256";
  readonly state: string;
}

export function parseBusinessMessagingConsentRequest(
  applicationIds: readonly string[], storeIds: readonly string[], redirectURIs: readonly string[] = [],
  challenges: readonly string[] = [], methods: readonly string[] = [], states: readonly string[] = [],
) {
  const [applicationId] = applicationIds;
  const [storeId] = storeIds;
  if (applicationIds.length !== 1 || storeIds.length !== 1 || !applicationId || !storeId || !uuidPattern.test(applicationId) || !uuidPattern.test(storeId)) return null;
  const hasAuthorization = [redirectURIs, challenges, methods, states].some((values) => values.length > 0);
  if (!hasAuthorization) return { applicationId, storeId, authorization: null };
  if ([redirectURIs, challenges, methods, states].some((values) => values.length !== 1)) return null;
  const [redirectUri] = redirectURIs;
  const [codeChallenge] = challenges;
  const [codeChallengeMethod] = methods;
  const [state] = states;
  if (!redirectUri || redirectUri.length > 2048 || !codeChallenge || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge) || codeChallengeMethod !== "S256" || !state || new TextEncoder().encode(state).length < 16 || new TextEncoder().encode(state).length > 512 || !state.trim()) return null;
  try {
    const callback = new URL(redirectUri);
    const loopback = callback.hostname === "localhost" || callback.hostname === "127.0.0.1" || callback.hostname === "[::1]";
    if (callback.username || callback.password || callback.hash || callback.protocol !== "https:" && !(callback.protocol === "http:" && loopback)) return null;
    if (["code", "state", "error"].some((key) => callback.searchParams.has(key))) return null;
  } catch {
    return null;
  }
  const authorization: BusinessMessagingAuthorizationRequest = { redirectUri, codeChallenge, codeChallengeMethod, state };
  return { applicationId, storeId, authorization };
}

export function isGrantableBusinessMessagingScope(scope: string): scope is BusinessMessagingScope {
  return Object.hasOwn(businessMessagingScopeDescriptions, scope);
}

export function getGrantableBusinessMessagingScopes(scopes: readonly string[]): BusinessMessagingScope[] {
  return [...new Set(scopes.filter(isGrantableBusinessMessagingScope))];
}
