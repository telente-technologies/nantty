export interface MockPrincipal {
  readonly userId: string;
  readonly actorName: string;
}

export interface MockRequest {
  readonly method: string;
  readonly path: string;
  readonly params: Record<string, string>;
  readonly query: URLSearchParams;
  readonly jsonBody: unknown;
  readonly binaryBody: Uint8Array | null;
  readonly headers: Headers;
  readonly principal: MockPrincipal | null;
}

export interface MockResponse {
  readonly status: number;
  readonly body: unknown;
  readonly contentType?: string;
  readonly headers?: Record<string, string>;
}

export type MockHandler = (request: MockRequest) => MockResponse | Promise<MockResponse>;

interface RegisteredMockRoute {
  readonly method: string;
  readonly pathPattern: RegExp;
  readonly parameterNames: string[];
  readonly handler: MockHandler;
  readonly requiresPrincipal: boolean;
}

const registeredMockRoutes: RegisteredMockRoute[] = [];

function compilePathTemplate(pathTemplate: string): { pathPattern: RegExp; parameterNames: string[] } {
  const parameterNames: string[] = [];
  const escapedPattern = pathTemplate
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        parameterNames.push(segment.slice(1));
        return "([^/]+)";
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { pathPattern: new RegExp(`^${escapedPattern}$`), parameterNames };
}

export function registerMockRoute(method: string, pathTemplate: string, handler: MockHandler, options: { readonly public?: boolean } = {}): void {
  const { pathPattern, parameterNames } = compilePathTemplate(pathTemplate);
  registeredMockRoutes.push({ method, pathPattern, parameterNames, handler, requiresPrincipal: !options.public });
}

export function findMockRouteForRequest(method: string, path: string): { route: RegisteredMockRoute; params: Record<string, string> } | null {
  for (const route of registeredMockRoutes) {
    if (route.method !== method) continue;
    const match = route.pathPattern.exec(path);
    if (!match) continue;
    const params: Record<string, string> = {};
    route.parameterNames.forEach((parameterName, index) => {
      params[parameterName] = decodeURIComponent(match[index + 1] ?? "");
    });
    return { route, params };
  }
  return null;
}
