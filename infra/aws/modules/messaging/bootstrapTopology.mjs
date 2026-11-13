import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildRabbitMQTopologyDefinitions } from "../../../local/rabbitmq/topologyDefinitions.mjs";

const requestTimeoutMs = 10000;
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const topology = JSON.parse(readFileSync(path.resolve(moduleDirectory, "../../../local/rabbitmq/topology.json"), "utf8"));
export const rabbitMQTopologyServiceNames = Object.keys(topology.services);

function endpointFor(base, ...segments) {
  const endpoint = new URL(base);
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/api/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
  endpoint.search = "";
  endpoint.hash = "";
  return endpoint;
}

function validateManagementUrl(value) {
  const endpoint = new URL(value);
  const localHttp = endpoint.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(endpoint.hostname);
  if (endpoint.protocol !== "https:" && !localHttp) throw new Error("RabbitMQ management URL must use HTTPS (HTTP is allowed only on loopback)");
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error("RabbitMQ management URL must not contain credentials, query, or fragment");
  return endpoint;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function definitionsForVhost(sourceTopology, credentialsByService) {
  const generated = buildRabbitMQTopologyDefinitions(sourceTopology);
  const credentials = Object.entries(sourceTopology.services).map(([service, grants]) => {
    const credential = credentialsByService[service];
    if (!credential || credential.username !== service || !credential.password) {
      throw new Error(`Missing valid RabbitMQ service credentials for ${service}`);
    }
    return {
      user: service,
      configure: "^$",
      write: generated.servicePermissions.find((permission) => permission.user === service).write,
      read: generated.servicePermissions.find((permission) => permission.user === service).read,
      topicPermission: generated.servicePermissions.find((permission) => permission.user === service).topicPermission,
      consumes: grants.consumes ?? [],
    };
  });

  return {
    exchanges: generated.exchanges.map(({ vhost: _vhost, ...entry }) => entry),
    queues: generated.queues.map(({ vhost: _vhost, ...entry }) => entry),
    bindings: generated.bindings.map(({ vhost: _vhost, ...entry }) => entry),
    permissions: credentials.map(({ user, configure, write, read }) => ({ user, configure, write, read })),
    topic_permissions: credentials.map(({ user, topicPermission }) => ({
      user,
      exchange: topicPermission.exchange,
      write: topicPermission.write,
      read: topicPermission.read,
      configure: topicPermission.configure,
    })),
  };
}

function ensureNoImmutableConflicts(existing, desired) {
  for (const kind of ["exchanges", "queues"]) {
    const existingByName = new Map((existing[kind] ?? []).map((entry) => [entry.name, entry]));
    for (const target of desired[kind]) {
      const current = existingByName.get(target.name);
      if (!current) continue;
      const currentShape = kind === "queues"
        ? { durable: current.durable, auto_delete: current.auto_delete, arguments: current.arguments ?? {} }
        : { type: current.type, durable: current.durable, auto_delete: current.auto_delete, internal: current.internal, arguments: current.arguments ?? {} };
      const targetShape = kind === "queues"
        ? { durable: target.durable, auto_delete: target.auto_delete, arguments: target.arguments ?? {} }
        : { type: target.type, durable: target.durable, auto_delete: target.auto_delete, internal: target.internal, arguments: target.arguments ?? {} };
      if (stableJson(currentShape) !== stableJson(targetShape)) {
        throw new Error(`Existing RabbitMQ ${kind.slice(0, -1)} ${target.name} conflicts with the reviewed topology; refusing import`);
      }
    }
  }

  for (const binding of desired.bindings) {
    // RabbitMQ bindings are immutable. An incompatible binding with the same endpoints
    // and routing key can be ignored by import, so reject it before the write.
    const conflicting = (existing.bindings ?? []).some((candidate) =>
      candidate.source === binding.source && candidate.destination === binding.destination &&
      candidate.destination_type === binding.destination_type && candidate.routing_key === binding.routing_key &&
      stableJson(candidate.arguments ?? {}) !== stableJson(binding.arguments ?? {}));
    if (conflicting) throw new Error(`Existing RabbitMQ binding ${binding.source} -> ${binding.destination} conflicts with the reviewed topology; refusing import`);
  }
}

async function requestManagement(base, pathSegments, username, password, method = "GET", body, fetchImplementation = fetch) {
  const response = await fetchImplementation(endpointFor(base, ...pathSegments), {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(requestTimeoutMs),
    redirect: "error",
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`RabbitMQ management API ${method} ${pathSegments[0]} returned HTTP ${response.status}`);
  }
  return response;
}

function verifyImportedDefinitions(actual, expected) {
  const assertNames = (kind) => {
    const actualNames = new Set((actual[kind] ?? []).map((entry) => entry.name));
    for (const entry of expected[kind]) if (!actualNames.has(entry.name)) throw new Error(`RabbitMQ topology verification missing ${kind.slice(0, -1)} ${entry.name}`);
  };
  assertNames("exchanges");
  assertNames("queues");

  const actualBindings = new Set((actual.bindings ?? []).map((binding) => stableJson({
    source: binding.source,
    destination: binding.destination,
    destination_type: binding.destination_type,
    routing_key: binding.routing_key,
    arguments: binding.arguments ?? {},
  })));
  for (const binding of expected.bindings) {
    const key = stableJson({
      source: binding.source,
      destination: binding.destination,
      destination_type: binding.destination_type,
      routing_key: binding.routing_key,
      arguments: binding.arguments ?? {},
    });
    if (!actualBindings.has(key)) throw new Error(`RabbitMQ topology verification missing binding ${binding.source} -> ${binding.destination}`);
  }

  const actualPermissions = new Map((actual.permissions ?? []).map((permission) => [permission.user, permission]));
  for (const permission of expected.permissions) {
    const actualPermission = actualPermissions.get(permission.user);
    if (!actualPermission || ["configure", "write", "read"].some((field) => actualPermission[field] !== permission[field])) {
      throw new Error(`RabbitMQ topology verification failed permissions for ${permission.user}`);
    }
  }

  const actualTopicPermissions = new Map((actual.topic_permissions ?? []).map((permission) => [permission.user, permission]));
  for (const permission of expected.topic_permissions) {
    const actualPermission = actualTopicPermissions.get(permission.user);
    if (!actualPermission || ["exchange", "configure", "write", "read"].some((field) => actualPermission[field] !== permission[field])) {
      throw new Error(`RabbitMQ topology verification failed topic permissions for ${permission.user}`);
    }
  }
}

export async function bootstrapRabbitMQTopology(configuration, dependencies = {}) {
  const managementUrl = validateManagementUrl(configuration.managementUrl).toString();
  const { adminUsername, adminPassword, environment, apply = false, confirmProduction = false } = configuration;
  if (!environment || !["dev", "staging", "prod"].includes(environment)) throw new Error("Environment must be dev, staging, or prod");
  if (![adminUsername, adminPassword].every((value) => typeof value === "string" && value.trim())) throw new Error("RabbitMQ administrator credentials are incomplete");
  if (environment === "prod" && apply && !confirmProduction) throw new Error("Production topology changes require --confirm-prod");

  const serviceNames = Object.keys(topology.services);
  if (!apply) return { applied: false, environment, vhost: topology.vhost, serviceCount: serviceNames.length, ...buildCounts(topology) };

  const credentialsByService = dependencies.credentialsByService;
  const definitions = definitionsForVhost(topology, credentialsByService ?? {});
  const fetchImplementation = dependencies.fetch ?? fetch;
  await requestManagement(managementUrl, ["vhosts", topology.vhost], adminUsername, adminPassword, "PUT", {}, fetchImplementation);

  const currentResponse = await requestManagement(managementUrl, ["definitions", topology.vhost], adminUsername, adminPassword, "GET", undefined, fetchImplementation);
  const existing = await currentResponse.json();
  ensureNoImmutableConflicts(existing, definitions);

  for (const serviceName of serviceNames) {
    const { username, password } = credentialsByService[serviceName];
    await requestManagement(managementUrl, ["users", username], adminUsername, adminPassword, "PUT", { password, tags: "" }, fetchImplementation);
  }
  await requestManagement(managementUrl, ["definitions", topology.vhost], adminUsername, adminPassword, "POST", definitions, fetchImplementation);

  const verificationResponse = await requestManagement(managementUrl, ["definitions", topology.vhost], adminUsername, adminPassword, "GET", undefined, fetchImplementation);
  const verification = await verificationResponse.json();
  verifyImportedDefinitions(verification, definitions);
  return { applied: true, environment, vhost: topology.vhost, serviceCount: serviceNames.length, ...buildCounts(topology) };
}

function buildCounts(sourceTopology) {
  const generated = buildRabbitMQTopologyDefinitions(sourceTopology);
  return { exchangeCount: generated.exchanges.length, queueCount: generated.queues.length, bindingCount: generated.bindings.length };
}

function secretString(secretId) {
  const result = execFileSync("aws", ["secretsmanager", "get-secret-value", "--secret-id", secretId, "--query", "SecretString", "--output", "text"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(result);
}

function parseArguments(argumentsList) {
  const options = { apply: false, confirmProduction: false };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--apply") options.apply = true;
    else if (argument === "--confirm-prod") options.confirmProduction = true;
    else if (argument === "--environment") options.environment = argumentsList[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.environment) throw new Error("Pass --environment dev|staging|prod");
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (!options.apply) {
      const result = await bootstrapRabbitMQTopology({ ...options, managementUrl: "https://dry-run.invalid", adminUsername: "dry-run", adminPassword: "dry-run" });
      console.log(`RabbitMQ topology dry-run (${result.environment}): ${result.exchangeCount} exchanges, ${result.queueCount} queues, ${result.bindingCount} bindings, ${result.serviceCount} service users. No AWS calls or broker writes performed.`);
    } else {
      const admin = secretString(`nantty/${options.environment}/mq/admin`);
      const credentialsByService = Object.fromEntries(Object.keys(topology.services).map((service) => {
        const secret = secretString(`nantty/${options.environment}/mq/${service}`);
        return [service, { username: secret.username, password: secret.password }];
      }));
      const result = await bootstrapRabbitMQTopology({ ...options, managementUrl: admin.management_url, adminUsername: admin.username, adminPassword: admin.password }, { credentialsByService });
      console.log(`RabbitMQ topology applied and verified (${result.environment}): ${result.exchangeCount} exchanges, ${result.queueCount} queues, ${result.bindingCount} bindings, ${result.serviceCount} service users.`);
    }
  } catch (error) {
    console.error(`RabbitMQ topology bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  }
}
