import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export interface RouteObservation {
  readonly route: string;
  readonly actor: string;
  readonly status: number;
  readonly verdict: "pass" | "fail";
  readonly reason?: string;
}

const reportDirectory = process.env["SMOKE_REPORT_DIR"] ?? resolve(import.meta.dirname, "../reports");

export function writeSmokeReport(name: string, content: unknown): void {
  mkdirSync(reportDirectory, { recursive: true });
  writeFileSync(resolve(reportDirectory, `${name}.json`), JSON.stringify(content, null, 1));
}

export function isErrorShape(body: unknown): boolean {
  return typeof body === "object" && body !== null && typeof (body as { message?: unknown }).message === "string" && typeof (body as { code?: unknown }).code === "string";
}

export function isListEnvelope(body: unknown): boolean {
  if (typeof body !== "object" || body === null || !Array.isArray((body as { data?: unknown }).data)) return false;
  const cursor = (body as { nextCursor?: unknown }).nextCursor;
  return "nextCursor" in body && (cursor === null || typeof cursor === "string");
}
