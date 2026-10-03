export type MockMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface MockContext {
  readonly params: Record<string, string>;
  readonly query: URLSearchParams;
  readonly body: unknown;
  readonly idempotencyKey?: string;
  readonly isGuest?: boolean;
}

export interface MockRoute {
  readonly method: MockMethod;
  readonly path: string;
  readonly handler: (ctx: MockContext) => unknown;
}

export const mockPage = <T>(data: readonly T[]): { data: readonly T[]; nextCursor: string | null } => ({ data, nextCursor: null });

export const createMockRoute = (method: MockMethod, path: string, handler: MockRoute["handler"]): MockRoute => ({ method, path, handler });

export const matchMockPathAndExtractParams = (pattern: string, path: string): Record<string, string> | null => {
  const a = pattern.split("/");
  const b = path.split("/");
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.startsWith(":")) params[a[i]!.slice(1)] = decodeURIComponent(b[i]!);
    else if (a[i] !== b[i]) return null;
  }
  return params;
};
