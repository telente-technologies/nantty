import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const topology = JSON.parse(readFileSync(join(here, "topology.json"), "utf8"));
const vhost = topology.vhost;
const exchanges = { events: "zudomart.events", unrouted: "zudomart.unrouted", jobs: "zudomart.jobs", retry: "zudomart.retry", deadLetter: "zudomart.dlx" };
const unroutedQueue = "unrouted-events";

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const anyOf = (values) => (values.length === 0 ? "^$" : `^(${values.map(escape).join("|")})$`);

function localPasswordHash(user) {
  const salt = createHash("sha256").update(`zudomart-local-salt:${user}`).digest().subarray(0, 4);
  const digest = createHash("sha256").update(Buffer.concat([salt, Buffer.from(`${user}-local-only`, "utf8")])).digest();
  return Buffer.concat([salt, digest]).toString("base64");
}

const user = (name, tags) => ({ name, password_hash: localPasswordHash(name), hashing_algorithm: "rabbit_password_hashing_sha256", tags });
const queue = (name, args) => ({ name, vhost, durable: true, auto_delete: false, arguments: { "x-queue-type": "quorum", ...args } });
const exchange = (name, type, args = {}) => ({ name, vhost, type, durable: true, auto_delete: false, internal: false, arguments: args });
const binding = (source, destination, routingKey) => ({ source, vhost, destination, destination_type: "queue", routing_key: routingKey, arguments: {} });

const queues = [queue(unroutedQueue, { "x-message-ttl": topology.unroutedRetentionMs, "x-max-length": 100000, "x-overflow": "drop-head" })];
const bindings = [binding(exchanges.unrouted, unroutedQueue, "")];

function declareQueueWithRetriesAndDeadLetter(name) {
  const safety = { "x-dead-letter-strategy": "at-least-once", "x-overflow": "reject-publish" };
  queues.push(queue(name, { ...safety, "x-dead-letter-exchange": exchanges.deadLetter, "x-dead-letter-routing-key": `${name}.dlq` }));
  queues.push(queue(`${name}.dlq`, {}));
  bindings.push(binding(exchanges.deadLetter, `${name}.dlq`, `${name}.dlq`));
  bindings.push(binding(exchanges.retry, name, name));
  for (const [tier, ttl] of Object.entries(topology.retryTiers)) {
    const retryQueue = `${name}.retry.${tier}`;
    queues.push(queue(retryQueue, { ...safety, "x-message-ttl": ttl, "x-dead-letter-exchange": exchanges.retry, "x-dead-letter-routing-key": name }));
    bindings.push(binding(exchanges.retry, retryQueue, retryQueue));
  }
}

for (const [name, routingKeys] of Object.entries(topology.eventQueues)) {
  declareQueueWithRetriesAndDeadLetter(name);
  for (const routingKey of routingKeys) bindings.push(binding(exchanges.events, name, routingKey));
}
for (const name of topology.jobQueues) {
  declareQueueWithRetriesAndDeadLetter(name);
  bindings.push(binding(exchanges.jobs, name, name));
}

const declaredQueues = new Set(queues.map((entry) => entry.name));
const users = [user(topology.administrator, ["administrator"])];
const permissions = [{ user: topology.administrator, vhost, configure: ".*", write: ".*", read: ".*" }];
const topicPermissions = [];
for (const [service, grants] of Object.entries(topology.services)) {
  const consumes = grants.consumes ?? [];
  for (const name of consumes) if (!declaredQueues.has(name)) throw new Error(`${service} consumes undeclared queue ${name}`);
  const writes = [...(grants.publishesEvents ? [exchanges.events] : []), ...(grants.enqueuesJobs ? [exchanges.jobs] : []), ...(consumes.length > 0 ? [exchanges.retry] : [])];
  users.push(user(service, []));
  permissions.push({ user: service, vhost, configure: "^$", write: anyOf(writes), read: anyOf(consumes) });
  topicPermissions.push({ user: service, vhost, exchange: exchanges.retry, write: consumes.length === 0 ? "^$" : `^(${consumes.map(escape).join("|")})\\.retry\\.`, read: "^$" });
}

const definitions = {
  users,
  vhosts: [{ name: vhost }],
  permissions,
  topic_permissions: topicPermissions,
  parameters: [],
  policies: [],
  exchanges: [
    exchange(exchanges.events, "topic", { "alternate-exchange": exchanges.unrouted }),
    exchange(exchanges.unrouted, "fanout"),
    exchange(exchanges.jobs, "direct"),
    exchange(exchanges.retry, "topic"),
    exchange(exchanges.deadLetter, "direct"),
  ],
  queues,
  bindings,
};

writeFileSync(join(here, "definitions.json"), `${JSON.stringify(definitions, null, 2)}\n`);
console.log(`definitions.json: ${users.length} users, ${queues.length} queues, ${bindings.length} bindings`);
