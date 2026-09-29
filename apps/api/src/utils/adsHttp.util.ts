import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";
import type { SchemaIssue } from "@zudojs/schema";

import { AdsValidationFailure } from "../errors/ads.error.js";
import { json, readJsonBody } from "./http.util.js";

export const DEFAULT_ADS_PAGE_SIZE = 50;

export function adsValidationFailed(issues: readonly { readonly path: string; readonly message: string }[]): HttpResponseContext {
  return json(400, { message: issues[0]?.message ?? "Validation failed", code: "VALIDATION_FAILED", issues });
}

export function convertSchemaIssues(issues: readonly SchemaIssue[]): { path: string; message: string }[] {
  return issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }));
}

export async function respondToAdsRequest(work: () => Promise<HttpResponseContext>): Promise<HttpResponseContext> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AdsValidationFailure) return adsValidationFailed(error.issues);
    throw error;
  }
}

export interface AdsSchema<T> {
  safeParse(value: unknown): { readonly success: true; readonly data: T } | { readonly success: false; readonly issues: readonly SchemaIssue[] };
}

export function parseAdsInput<T>(schemaDefinition: AdsSchema<T>, value: unknown): T {
  const parsed = schemaDefinition.safeParse(value);
  if (!parsed.success) throw new AdsValidationFailure(convertSchemaIssues(parsed.issues));
  return parsed.data;
}

export function parseAdsBody<T>(schemaDefinition: AdsSchema<T>, ctx: HttpRouterContext): T {
  return parseAdsInput(schemaDefinition, readJsonBody(ctx) ?? {});
}

export function readRouteParameter(ctx: HttpRouterContext, name: string): string {
  const value = (ctx.params as Record<string, string | undefined>)[name];
  return typeof value === "string" ? value : "";
}
