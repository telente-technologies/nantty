const safeAccountForwardPathPattern = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*(?:\?[A-Za-z0-9_=&%.-]*)?$/;
const longestAccountForwardPath = 200;

export function isSafeAccountForwardPath(forwardPath: string | null): forwardPath is string {
  return Boolean(forwardPath) && (forwardPath?.length ?? 0) <= longestAccountForwardPath && safeAccountForwardPathPattern.test(forwardPath ?? "");
}

export function buildAccountForwardPath(accountId: string, forwardPath: string | null): string {
  const accountPath = `/accounts/${encodeURIComponent(accountId)}`;
  return isSafeAccountForwardPath(forwardPath) ? `${accountPath}/${forwardPath}` : `${accountPath}/overview`;
}
