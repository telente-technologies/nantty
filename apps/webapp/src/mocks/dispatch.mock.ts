import { ApiError } from "@/errors/api.error";
import type { MockRoute } from "@/mocks/registry.mock";

import { routes } from "@/mocks";

const matchMockPathAndExtractParams = (pattern: string, path: string): Record<string, string> | null => {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < patternParts.length; index++) {
    const patternPart = patternParts[index]!;
    const pathPart = pathParts[index]!;
    if (patternPart.startsWith(":")) params[patternPart.slice(1)] = decodeURIComponent(pathPart);
    else if (patternPart !== pathPart) return null;
  }
  return params;
};

function findMatchingRoute(method: string, path: string): { route: MockRoute; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    const params = matchMockPathAndExtractParams(route.path, path);
    if (params) return { route, params };
  }
  return null;
}

export async function dispatchMockApiRequest(method: string, path: string, query: URLSearchParams, body: Uint8Array | null, headers: Readonly<Record<string, string>> = {}): Promise<unknown> {
  const match = findMatchingRoute(method, path);
  if (!match) throw new ApiError(404, `No mock for ${method} ${path}`, "MOCK_ROUTE_NOT_FOUND");
  let parsedBody: unknown = undefined;
  if (body && body.byteLength > 0) {
    try {
      parsedBody = JSON.parse(new TextDecoder().decode(body));
    } catch {
      parsedBody = undefined;
    }
  }
  return match.route.handler({ params: match.params, query, body: parsedBody, headers });
}

(globalThis as Record<string, unknown>).__nanttyMockBackend = "nantty-mock-backend-bundled";
