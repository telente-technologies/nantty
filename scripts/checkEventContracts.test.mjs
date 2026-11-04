import test from "node:test";
import assert from "node:assert/strict";
import { validateEventContracts } from "./checkEventContracts.mjs";

const validFixtures = () => ({
  asyncApi: [
    "      name: payment.succeeded",
    "      headers: { type: object, properties: { eventType: { const: payment.succeeded } } }",
    "      payload: { $ref: './schemas/payment.succeeded.v1.json' }",
  ].join("\n"),
  topology: { eventQueues: { payments: ["payment.succeeded"] } },
  schemas: {
    "envelope.v1.json": { $id: "https://contracts.nantty.com/events/envelope.v1.json" },
    "payment.succeeded.v1.json": { $id: "https://contracts.nantty.com/events/payment.succeeded.v1.json" },
  },
});

test("accepts valid message, schema references, and queue routing", () => {
  const result = validateEventContracts(validFixtures());
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.messageCount, 1);
  assert.equal(result.schemaCount, 2);
});

test("reports missing schema references, event name mismatch, and invalid schema IDs", () => {
  const fixture = validFixtures();
  fixture.asyncApi = fixture.asyncApi
    .replace("payment.succeeded }", "payment.failed }")
    .replace("payment.succeeded.v1.json", "missing.v1.json");
  fixture.schemas["payment.succeeded.v1.json"].$id = "https://contracts.nantty.com/events/wrong.v1.json";

  const result = validateEventContracts(fixture);
  assert.ok(result.errors.some((error) => error.includes("references missing schema missing.v1.json")));
  assert.ok(result.errors.some((error) => error.includes("declares eventType payment.failed")));
  assert.ok(result.errors.some((error) => error.includes("$id basename must match its filename")));
});

test("reports unreferenced payload schemas and routing keys without payload contracts", () => {
  const fixture = validFixtures();
  fixture.schemas["legacy.event.v1.json"] = {
    $id: "https://contracts.nantty.com/events/legacy.event.v1.json",
  };
  fixture.topology.eventQueues.payments.push("legacy.event", "unknown.event");

  const result = validateEventContracts(fixture);
  assert.equal(result.errors.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("not referenced by AsyncAPI: legacy.event.v1.json")));
  assert.ok(result.warnings.some((warning) => warning.includes("binds unknown.event without a payload schema")));
});
