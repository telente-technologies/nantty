import assert from "node:assert/strict";
import test from "node:test";

import { bootstrapRabbitMQTopology, rabbitMQTopologyServiceNames } from "./bootstrapTopology.mjs";

function credentials() {
  return Object.fromEntries(rabbitMQTopologyServiceNames.map((name) => [name, { username: name, password: `secret-${name}` }]));
}

function mockManagementFetch({ initialDefinitions = emptyDefinitions(), failVerification = false } = {}) {
  const calls = [];
  let importedDefinitions = null;
  let definitionReads = 0;
  const fetch = async (url, options) => {
    const parsedUrl = new URL(url);
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ method: options.method, pathname: parsedUrl.pathname, body, authorization: options.headers.Authorization });
    if (options.method === "GET" && parsedUrl.pathname.includes("/definitions/")) {
      definitionReads += 1;
      const data = definitionReads === 1 ? initialDefinitions : importedDefinitions ?? emptyDefinitions();
      if (failVerification && definitionReads > 1) return jsonResponse({ ...data, queues: [] });
      return jsonResponse(data);
    }
    if (options.method === "POST" && parsedUrl.pathname.includes("/definitions/")) importedDefinitions = body;
    return new Response(null, { status: options.method === "PUT" ? 204 : 200 });
  };
  return { calls, fetch };
}

function emptyDefinitions() {
  return { exchanges: [], queues: [], bindings: [], permissions: [], topic_permissions: [] };
}

function jsonResponse(value) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

const configuration = {
  environment: "staging",
  managementUrl: "https://broker.example",
  adminUsername: "broker-admin",
  adminPassword: "admin-secret",
};

test("dry run reports planned topology without requiring service credentials or contacting the broker", async () => {
  let fetchCalled = false;
  const result = await bootstrapRabbitMQTopology(configuration, {
    fetch: async () => { fetchCalled = true; throw new Error("should not call"); },
  });

  assert.equal(fetchCalled, false);
  assert.deepEqual(result, {
    applied: false,
    environment: "staging",
    vhost: "nantty",
    serviceCount: rabbitMQTopologyServiceNames.length,
    exchangeCount: 5,
    queueCount: 169,
    bindingCount: 428,
  });
});

test("applies vhost-specific definitions and per-service secrets, then verifies topology", async () => {
  const management = mockManagementFetch();
  const result = await bootstrapRabbitMQTopology({ ...configuration, apply: true }, {
    credentialsByService: credentials(),
    fetch: management.fetch,
  });

  assert.equal(result.applied, true);
  assert.equal(management.calls[0].pathname, "/api/vhosts/nantty");
  assert.equal(management.calls.filter(({ method, pathname }) => method === "PUT" && pathname.startsWith("/api/users/")).length, rabbitMQTopologyServiceNames.length);
  assert.equal(management.calls.filter(({ method, pathname }) => method === "POST" && pathname === "/api/definitions/nantty").length, 1);
  assert.equal(management.calls.filter(({ method, pathname }) => method === "GET" && pathname === "/api/definitions/nantty").length, 2);

  const serviceUserWrite = management.calls.find(({ pathname }) => pathname === "/api/users/go-commerce");
  assert.deepEqual(serviceUserWrite.body, { password: "secret-go-commerce", tags: "" });
  const importCall = management.calls.find(({ method }) => method === "POST");
  assert.equal(JSON.stringify(importCall.body).includes("secret-"), false);
  assert.ok(importCall.body.queues.some(({ name }) => name === "intelligence-domain-events"));
  assert.ok(importCall.body.bindings.some(({ destination, routing_key }) => destination === "intelligence-domain-events" && routing_key === "product.purchased"));
  assert.ok(importCall.body.permissions.some(({ user }) => user === "intelligence"));
});

test("requires explicit apply and the production confirmation flag before production writes", async () => {
  const management = mockManagementFetch();
  await assert.rejects(
    bootstrapRabbitMQTopology({ ...configuration, environment: "prod", apply: true }, {
      credentialsByService: credentials(), fetch: management.fetch,
    }),
    /require --confirm-prod/,
  );
  assert.equal(management.calls.length, 0);
});

test("rejects an incompatible existing queue before changing users or importing", async () => {
  const management = mockManagementFetch({
    initialDefinitions: {
      ...emptyDefinitions(),
      queues: [{ name: "intelligence-domain-events", durable: false, auto_delete: false, arguments: {} }],
    },
  });
  await assert.rejects(
    bootstrapRabbitMQTopology({ ...configuration, apply: true }, {
      credentialsByService: credentials(), fetch: management.fetch,
    }),
    /conflicts with the reviewed topology/,
  );
  assert.equal(management.calls.some(({ pathname }) => pathname.startsWith("/api/users/")), false);
  assert.equal(management.calls.some(({ method }) => method === "POST"), false);
});

test("fails when the post-import verification is incomplete", async () => {
  const management = mockManagementFetch({ failVerification: true });
  await assert.rejects(
    bootstrapRabbitMQTopology({ ...configuration, apply: true }, {
      credentialsByService: credentials(), fetch: management.fetch,
    }),
    /verification missing queue/,
  );
});

test("rejects remote HTTP and missing service credentials before broker writes", async () => {
  const management = mockManagementFetch();
  await assert.rejects(
    bootstrapRabbitMQTopology({ ...configuration, managementUrl: "http://broker.example", apply: true }, {
      credentialsByService: credentials(), fetch: management.fetch,
    }),
    /must use HTTPS/,
  );
  await assert.rejects(
    bootstrapRabbitMQTopology({ ...configuration, apply: true }, { credentialsByService: {}, fetch: management.fetch }),
    /Missing valid RabbitMQ service credentials/,
  );
  assert.equal(management.calls.length, 0);
});
