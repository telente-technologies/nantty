import type { Integration } from "./lifecycle.integration.js";
// zudojs:integration-imports:start
import { redisIntegration } from "./redis.integration.js";
import { cacheIntegration } from "./cache.integration.js";
import { storageIntegration } from "./storage.integration.js";
import { websocketsIntegration } from "./websockets.integration.js";
import { emailIntegration } from "./email.integration.js";
import { schedulerIntegration } from "./scheduler.integration.js";
import { databaseIntegration } from "./database.integration.js";
// zudojs:integration-imports:end

export {
  IntegrationsModule,
  checkIntegrations,
  drainIntegrations,
  type Integration,
  type IntegrationContext,
} from "./lifecycle.integration.js";

/**
 * Started with the runtime in this order and stopped in reverse.
 * `zudojs add <feature>` adds entries between the markers.
 */
export const integrations: readonly Integration[] = [
  // zudojs:integrations:start
  redisIntegration,
  cacheIntegration,
  storageIntegration,
  websocketsIntegration,
  emailIntegration,
  schedulerIntegration,
  databaseIntegration,
  // zudojs:integrations:end
];
