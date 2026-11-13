export type MockMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface MockContext {
  readonly params: Record<string, string>;
  readonly query: URLSearchParams;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface MockRoute {
  readonly method: MockMethod;
  readonly path: string;
  readonly handler: (ctx: MockContext) => unknown;
}

export const createMockRoute = (method: MockMethod, path: string, handler: MockRoute["handler"]): MockRoute => ({ method, path, handler });
