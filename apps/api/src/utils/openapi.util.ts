import type { RouteOptions } from "@zudojs/http";

interface RouteSchemas {
  readonly body?: unknown;
  readonly query?: unknown;
  readonly params?: unknown;
}

export function describeRoute(tag: string, summary: string, schemas: RouteSchemas = {}): Pick<RouteOptions, "openapi"> {
  return {
    openapi: {
      summary,
      tags: [tag],
      ...(schemas.body === undefined ? {} : { body: schemas.body }),
      ...(schemas.query === undefined ? {} : { query: schemas.query }),
      ...(schemas.params === undefined ? {} : { params: schemas.params }),
    } as NonNullable<Exclude<RouteOptions["openapi"], false>>,
  };
}
