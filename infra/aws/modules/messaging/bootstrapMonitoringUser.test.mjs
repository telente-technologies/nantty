import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { bootstrapRabbitMQMonitoringUser } from "./bootstrapMonitoringUser.mjs";

function basicAuthorization(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

test("provisions a monitoring-tagged user with empty vhost permissions and verifies queue access", async (t) => {
  const requests = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push({ method: request.method, url: request.url, authorization: request.headers.authorization, body: body ? JSON.parse(body) : undefined });
    if (request.method === "GET") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end("[{\"name\":\"orders\"}]");
      return;
    }
    response.writeHead(204);
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();

  const result = await bootstrapRabbitMQMonitoringUser({
    managementUrl: `http://127.0.0.1:${address.port}`,
    adminUsername: "broker-admin",
    adminPassword: "admin-secret",
    monitoringUsername: "nantty_monitor",
    monitoringPassword: "monitor-secret",
    vhost: "nantty",
  });

  assert.deepEqual(result, { queueCount: 1 });
  assert.deepEqual(requests.map(({ method, url }) => [method, url]), [
    ["PUT", "/api/users/nantty_monitor"],
    ["PUT", "/api/permissions/nantty/nantty_monitor"],
    ["GET", "/api/queues/nantty"],
  ]);
  assert.equal(requests[0].authorization, basicAuthorization("broker-admin", "admin-secret"));
  assert.deepEqual(requests[0].body, { password: "monitor-secret", tags: "monitoring" });
  assert.deepEqual(requests[1].body, { configure: "^$", write: "^$", read: "^$" });
  assert.equal(requests[2].authorization, basicAuthorization("nantty_monitor", "monitor-secret"));
});

test("encodes virtual-host path segments without granting broader permissions", async (t) => {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.url);
    response.writeHead(request.method === "GET" ? 200 : 204, { "content-type": "application/json" });
    response.end(request.method === "GET" ? "[]" : "");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();

  await bootstrapRabbitMQMonitoringUser({
    managementUrl: `http://127.0.0.1:${address.port}`,
    adminUsername: "admin",
    adminPassword: "admin-secret",
    monitoringUsername: "monitor",
    monitoringPassword: "monitor-secret",
    vhost: "/",
  });

  assert.deepEqual(requests, [
    "/api/users/monitor",
    "/api/permissions/%2F/monitor",
    "/api/queues/%2F",
  ]);
});

test("rejects remote HTTP and same-identity monitor credentials before making requests", async () => {
  const base = {
    managementUrl: "http://broker.example",
    adminUsername: "admin",
    adminPassword: "admin-secret",
    monitoringUsername: "monitor",
    monitoringPassword: "monitor-secret",
    vhost: "nantty",
  };

  await assert.rejects(bootstrapRabbitMQMonitoringUser(base), /must use HTTPS/);
  await assert.rejects(bootstrapRabbitMQMonitoringUser({ ...base, managementUrl: "https://broker.example", monitoringUsername: "admin" }), /must differ/);
});
