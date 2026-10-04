import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { isReservedTopLevelRoute, isUsernameProfilePath, topLevelRouteSegments } from "../config/reservedRoutes.config";

const appDirectory = join(dirname(fileURLToPath(import.meta.url)), "..", "app");
const goReservedTermsFile = join(appDirectory, "..", "..", "..", "..", "services", "go", "platform", "usernames", "reservedTerms.constant.go");

function listTopLevelSegmentsOnDisk(): string[] {
  const segments: string[] = [];
  for (const group of ["(app)", "(auth)", "."]) {
    for (const entry of readdirSync(join(appDirectory, group), { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith("(") && !entry.name.startsWith("[")) segments.push(entry.name);
      if (entry.isFile() && entry.name === "robots.ts") segments.push("robots.txt");
    }
  }
  return segments;
}

const lettersOnly = (value: string) => value.toLowerCase().replace(/\.(xml|txt)$/, "").replace(/[^a-z]/g, "");

test("every top-level webapp route is listed as reserved", () => {
  for (const segment of listTopLevelSegmentsOnDisk()) assert.ok(isReservedTopLevelRoute(segment), `${segment} is missing from topLevelRouteSegments`);
});

test("goIdentity reserves every top-level route that could look like a username", () => {
  const goSource = readFileSync(goReservedTermsFile, "utf8");
  const goTerms = new Set([...goSource.matchAll(/"([a-z0-9._-]+)"/g)].map((match) => lettersOnly(match[1] ?? "")));
  for (const segment of topLevelRouteSegments) {
    const normalized = lettersOnly(segment);
    if (normalized.length < 3) continue;
    assert.ok(goTerms.has(normalized), `${segment} must be reserved in services/go/platform/usernames/reservedTerms.constant.go`);
  }
});

test("username paths never shadow app routes", () => {
  assert.equal(isUsernameProfilePath("/ada.lovelace"), true);
  assert.equal(isUsernameProfilePath("/settings"), false);
  assert.equal(isUsernameProfilePath("/saved"), false);
  assert.equal(isUsernameProfilePath("/@ada"), false);
  assert.equal(isUsernameProfilePath("/ada/posts"), false);
});
