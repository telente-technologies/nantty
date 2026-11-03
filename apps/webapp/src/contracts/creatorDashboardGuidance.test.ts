import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const dashboardPath = fileURLToPath(new URL("../app/(app)/creator/page.tsx", import.meta.url));
const programPath = fileURLToPath(new URL("../app/(app)/creator/program/page.tsx", import.meta.url));

describe("creator dashboard application guidance", () => {
  it("routes web users to the existing creator program flow instead of requiring the mobile app", () => {
    const source = readFileSync(dashboardPath, "utf8");

    assert.equal(existsSync(programPath), true);
    assert.match(source, /href="\/creator\/program"/);
    assert.match(source, /Explore the Creator Program/);
    assert.doesNotMatch(source, /Apply in the Nantty app/);
  });
});
