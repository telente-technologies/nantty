import type { Integration } from "./integration.js";
// zudojs:integration-imports:start
import { redisIntegration } from "./redis.js";
import { cacheIntegration } from "./cache.js";
import { storageIntegration } from "./storage.js";
import { websocketsIntegration } from "./websockets.js";
import { emailIntegration } from "./email.js";
import { schedulerIntegration } from "./scheduler.js";
import { databaseIntegration } from "./database.js";
// zudojs:integration-imports:end

export {
  IntegrationsModule,
  checkIntegrations,
  drainIntegrations,
  type Integration,
  type IntegrationContext,
} from "./integration.js";

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
