import { createCommandBus, createQueryBus, type CommandBus, type QueryBus } from "@zudojs/cqrs";
import { createEventBus, type EventBus } from "@zudojs/events";

import type { AppSettings } from "../configs/settings.config.js";
import { systemClock, type Clock } from "../interfaces/clock.interface.js";
import type { Persistence } from "../interfaces/persistence.interface.js";
import { createAppLogger, type AppLogger } from "../loggers/app.logger.js";
import { FieldCipher } from "../utils/crypto.util.js";

export interface Core {
  readonly settings: AppSettings;
  readonly persistence: Persistence;
  readonly clock: Clock;
  readonly events: EventBus;
  readonly commands: CommandBus;
  readonly queries: QueryBus;
  readonly cipher: FieldCipher;
  readonly logger: AppLogger;
}

export interface CoreOptions {
  readonly settings: AppSettings;
  readonly persistence: Persistence;
  readonly clock?: Clock;
  readonly logger?: AppLogger;
}

export function createCore(options: CoreOptions): Core {
  const logger = options.logger ?? createAppLogger("zudomart");
  return {
    settings: options.settings,
    persistence: options.persistence,
    clock: options.clock ?? systemClock,
    events: createEventBus({
      onError: (error: unknown) => logger.error("An event handler failed", { error: String(error) }),
    }),
    commands: createCommandBus(),
    queries: createQueryBus(),
    cipher: new FieldCipher(options.settings.dataEncryptionKey),
    logger,
  };
}
