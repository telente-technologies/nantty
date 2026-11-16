import { createSandboxDatabase } from "./database.js";
import { loadSandboxConfig } from "./config.js";
import { createSandboxApp } from "./sandboxApp.js";
import { startWebhookDeliveryWorker } from "./webhookOutbox.js";

const config = loadSandboxConfig(process.env);
const database = createSandboxDatabase(config.databaseUrl);
const app = createSandboxApp({ database, controlToken: config.controlToken, secretEncryptionKey: config.webhookSecretEncryptionKey });

await app.listen({ host: config.host, port: config.port });
const stopWebhookWorker = config.webhookSecretEncryptionKey
  ? startWebhookDeliveryWorker(database, { secretEncryptionKey: config.webhookSecretEncryptionKey, onError: (code) => console.error(code) })
  : async () => undefined;

let closing = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (closing) return;
    closing = true;
    void stopWebhookWorker().then(() => app.close()).finally(() => database.end()).then(() => process.exit(0));
  });
}
