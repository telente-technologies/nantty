import { pathToFileURL } from "node:url";

const requestTimeoutMs = 5000;

function managementEndpoint(base, ...segments) {
  const endpoint = new URL(base);
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/api/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
  endpoint.search = "";
  endpoint.hash = "";
  return endpoint;
}

function validateConfiguration(configuration) {
  const endpoint = new URL(configuration.managementUrl);
  const localHttp = endpoint.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(endpoint.hostname);
  if (endpoint.protocol !== "https:" && !localHttp) throw new Error("RabbitMQ management URL must use HTTPS (HTTP is allowed only on loopback)");
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error("RabbitMQ management URL must not contain credentials, query, or fragment");
  if (![configuration.adminUsername, configuration.adminPassword, configuration.monitoringUsername, configuration.monitoringPassword, configuration.vhost].every((value) => typeof value === "string" && value.trim())) {
    throw new Error("RabbitMQ monitoring bootstrap configuration is incomplete");
  }
  if (configuration.adminUsername === configuration.monitoringUsername) throw new Error("RabbitMQ administrator and monitoring usernames must differ");
  return endpoint;
}

async function managementRequest(base, path, username, password, method = "GET", body) {
  const response = await fetch(managementEndpoint(base, ...path).toString(), {
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
    throw new Error(`RabbitMQ management API ${method} ${path[0]} returned HTTP ${response.status}`);
  }
  return response;
}

export async function bootstrapRabbitMQMonitoringUser(configuration) {
  const endpoint = validateConfiguration(configuration);
  const { adminUsername, adminPassword, monitoringUsername, monitoringPassword, vhost } = configuration;

  await managementRequest(endpoint, ["users", monitoringUsername], adminUsername, adminPassword, "PUT", {
    password: monitoringPassword,
    tags: "monitoring",
  });
  await managementRequest(endpoint, ["permissions", vhost, monitoringUsername], adminUsername, adminPassword, "PUT", {
    configure: "^$",
    write: "^$",
    read: "^$",
  });

  const verification = await managementRequest(endpoint, ["queues", vhost], monitoringUsername, monitoringPassword);
  const queues = await verification.json();
  if (!Array.isArray(queues)) throw new Error("RabbitMQ monitoring verification returned an invalid queue list");
  return { queueCount: queues.length };
}

function configurationFromEnvironment(environment) {
  return {
    managementUrl: environment.RABBITMQ_MANAGEMENT_URL ?? "",
    adminUsername: environment.RABBITMQ_MANAGEMENT_ADMIN_USERNAME ?? "",
    adminPassword: environment.RABBITMQ_MANAGEMENT_ADMIN_PASSWORD ?? "",
    monitoringUsername: environment.RABBITMQ_MONITORING_USERNAME ?? "",
    monitoringPassword: environment.RABBITMQ_MONITORING_PASSWORD ?? "",
    vhost: environment.RABBITMQ_VHOST ?? "nantty",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await bootstrapRabbitMQMonitoringUser(configurationFromEnvironment(process.env));
    console.log(`RabbitMQ read-only monitoring account provisioned and verified (${result.queueCount} queues visible).`);
  } catch (error) {
    console.error(`RabbitMQ monitoring bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  }
}
