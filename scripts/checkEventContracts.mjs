import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = join(fileURLToPath(new URL("..", import.meta.url)));
const contractRoot = join(repositoryRoot, "services/contracts/events");

export function validateEventContracts({ asyncApi, topology, schemas }) {
  const errors = [];
  const warnings = [];
  const schemaByFile = new Map();

  for (const [file, schema] of Object.entries(schemas)) {
    if (!file.endsWith(".json")) continue;
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      errors.push(`${file}: schema must be a JSON object`);
      continue;
    }
    if (basename(schema.$id ?? "") !== file) {
      errors.push(`${file}: $id basename must match its filename`);
    }
    if (schemaByFile.has(schema.$id)) errors.push(`${file}: duplicate schema $id ${schema.$id}`);
    schemaByFile.set(schema.$id, file);
  }

  const referencedSchemas = new Set();
  for (const match of asyncApi.matchAll(/(?:\.\/schemas\/)([A-Za-z0-9._-]+\.json)/g)) {
    const file = match[1];
    referencedSchemas.add(file);
    if (!Object.hasOwn(schemas, file)) errors.push(`AsyncAPI references missing schema ${file}`);
  }

  const messageNames = [];
  for (const match of asyncApi.matchAll(/^      name: ([A-Za-z0-9._-]+)\s*$/gm)) {
    messageNames.push(match[1]);
  }
  const seenMessages = new Set();
  for (const name of messageNames) {
    if (seenMessages.has(name)) errors.push(`AsyncAPI declares duplicate message ${name}`);
    seenMessages.add(name);
  }

  const messageBlocks = asyncApi.split(/^      name: /m).slice(1);
  for (const block of messageBlocks) {
    const name = block.split(/\r?\n/, 1)[0].trim();
    const eventType = block.match(/\bconst: ([A-Za-z0-9._-]+)/)?.[1];
    if (eventType && eventType !== name) errors.push(`AsyncAPI message ${name} declares eventType ${eventType}`);
  }

  for (const file of Object.keys(schemas)) {
    if (file.endsWith(".v1.json") && file !== "envelope.v1.json" && !referencedSchemas.has(file)) {
      warnings.push(`Payload schema is not referenced by AsyncAPI: ${file}`);
    }
  }

  const eventSchemaNames = new Set(
    Object.keys(schemas)
      .filter((file) => file.endsWith(".v1.json") && file !== "envelope.v1.json")
      .map((file) => file.replace(/\.v1\.json$/, "")),
  );
  for (const [queue, bindings] of Object.entries(topology.eventQueues ?? {})) {
    for (const binding of bindings) {
      if (!binding.includes("*") && !eventSchemaNames.has(binding)) {
        warnings.push(`Queue ${queue} binds ${binding} without a payload schema`);
      }
    }
  }

  if (!schemaByFile.has("https://contracts.nantty.com/events/envelope.v1.json")) {
    errors.push("Missing canonical envelope.v1.json schema");
  }

  return { errors, warnings, messageCount: messageNames.length, schemaCount: Object.keys(schemas).length };
}

function main() {
  const asyncApi = readFileSync(join(contractRoot, "asyncapi.yaml"), "utf8");
  const topology = JSON.parse(readFileSync(join(repositoryRoot, "infra/local/rabbitmq/topology.json"), "utf8"));
  const schemas = Object.fromEntries(
    readdirSync(join(contractRoot, "schemas"))
      .filter((file) => file.endsWith(".json"))
      .map((file) => [file, JSON.parse(readFileSync(join(contractRoot, "schemas", file), "utf8"))]),
  );
  const result = validateEventContracts({ asyncApi, topology, schemas });

  console.log(`Checked ${result.messageCount} AsyncAPI messages and ${result.schemaCount} JSON schemas.`);
  for (const warning of result.warnings.slice(0, 10)) console.warn(`WARN ${warning}`);
  if (result.warnings.length > 10) console.warn(`WARN ${result.warnings.length - 10} additional coverage warnings omitted.`);
  for (const error of result.errors) console.error(`ERROR ${error}`);
  console.log(`Result: ${result.errors.length} errors, ${result.warnings.length} coverage warnings.`);
  if (result.errors.length > 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
