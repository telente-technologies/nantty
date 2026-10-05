import { globalSearchScope, kindsAllowedInScope, type SearchScope } from "../enums/searchScope.enum.js";
import type { SearchKind } from "../types/searchDocument.type.js";
import { isSearchType, type SearchType } from "../enums/searchType.enum.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseSearchScope(raw: string | undefined): SearchScope | null {
  const value = raw?.trim() ?? "";
  if (value === "" || value === "global") return globalSearchScope;
  if (value === "mart") return { kind: "mart" };
  const separator = value.indexOf(":");
  const prefix = value.slice(0, separator);
  const id = value.slice(separator + 1).toLowerCase();
  if (separator < 0 || !uuidPattern.test(id)) return null;
  if (prefix === "store") return { kind: "store", storeId: id };
  if (prefix === "profile") return { kind: "profile", accountId: id };
  return null;
}

export function formatSearchScope(scope: SearchScope): string {
  if (scope.kind === "store") return `store:${scope.storeId}`;
  if (scope.kind === "profile") return `profile:${scope.accountId}`;
  return scope.kind;
}

export function restrictKindsToScope(kinds: readonly SearchKind[], scope: SearchScope): readonly SearchKind[] {
  const allowed = kindsAllowedInScope[scope.kind];
  return kinds.filter((kind) => allowed.includes(kind));
}

export function resolveScopeAndType(rawScope: string | undefined, rawType: SearchType | undefined): { readonly scope: SearchScope; readonly type: SearchType } | null {
  if (rawScope !== undefined && isSearchType(rawScope)) return { scope: globalSearchScope, type: rawType ?? rawScope };
  const scope = parseSearchScope(rawScope);
  if (scope === null) return null;
  const type = rawType ?? "top";
  return { scope, type: type === "all" && scope.kind !== "global" ? "top" : type };
}
