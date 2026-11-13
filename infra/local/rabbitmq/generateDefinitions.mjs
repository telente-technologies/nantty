import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildRabbitMQTopologyDefinitions } from "./topologyDefinitions.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const topology = JSON.parse(readFileSync(join(here, "topology.json"), "utf8"));
const vhost = topology.vhost;
const generatedTopology = buildRabbitMQTopologyDefinitions(topology);

function localPasswordHash(user) {
  const salt = createHash("sha256").update(`nantty-local-salt:${user}`).digest().subarray(0, 4);
  const digest = createHash("sha256").update(Buffer.concat([salt, Buffer.from(`${user}-local-only`, "utf8")])).digest();
  return Buffer.concat([salt, digest]).toString("base64");
}

const user = (name, tags) => ({ name, password_hash: localPasswordHash(name), hashing_algorithm: "rabbit_password_hashing_sha256", tags });
const users = [user(topology.administrator, ["administrator"]), user(topology.monitoringUser, ["monitoring"])];
const permissions = [
  { user: topology.administrator, vhost, configure: ".*", write: ".*", read: ".*" },
  { user: topology.monitoringUser, vhost, configure: "^$", write: "^$", read: "^$" },
];
const topicPermissions = [];
for (const servicePermission of generatedTopology.servicePermissions) {
  users.push(user(servicePermission.user, []));
  const { user: serviceUser, vhost: serviceVhost, configure, write, read, topicPermission } = servicePermission;
  permissions.push({ user: serviceUser, vhost: serviceVhost, configure, write, read });
  const { user: topicUser, vhost: topicVhost, exchange: topicExchange, write: topicWrite, read: topicRead } = topicPermission;
  topicPermissions.push({ user: topicUser, vhost: topicVhost, exchange: topicExchange, write: topicWrite, read: topicRead });
}

const definitions = {
  users,
  vhosts: [{ name: vhost }],
  permissions,
  topic_permissions: topicPermissions,
  parameters: [],
  policies: [],
  exchanges: generatedTopology.exchanges,
  queues: generatedTopology.queues,
  bindings: generatedTopology.bindings,
};

writeFileSync(join(here, "definitions.json"), `${JSON.stringify(definitions, null, 2)}\n`);
console.log(`definitions.json: ${users.length} users, ${generatedTopology.queues.length} queues, ${generatedTopology.bindings.length} bindings`);
