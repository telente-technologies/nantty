export const businessMessagingScopeDescriptions = {
  "messages:send": "Send messages to customers who have consented to this business conversation.",
  "messages:read": "Read messages covered by the business messaging consent rules.",
  "conversations:read": "View conversations associated with this store.",
} as const;

export type BusinessMessagingScope = keyof typeof businessMessagingScopeDescriptions;

export function isGrantableBusinessMessagingScope(scope: string): scope is BusinessMessagingScope {
  return Object.hasOwn(businessMessagingScopeDescriptions, scope);
}

export function getGrantableBusinessMessagingScopes(scopes: readonly string[]): BusinessMessagingScope[] {
  return [...new Set(scopes.filter(isGrantableBusinessMessagingScope))];
}
