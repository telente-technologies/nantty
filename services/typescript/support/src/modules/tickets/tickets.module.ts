import type { Clock } from "../../interfaces/clock.interface.js";
import type { MediaDirectory } from "../../interfaces/mediaDirectory.interface.js";
import type { IdentityDirectory } from "../../interfaces/identityDirectory.interface.js";
import type { TicketStore } from "../../interfaces/ticketStore.interface.js";

export interface TicketModuleDependencies {
  readonly store: TicketStore;
  readonly clock: Clock;
  readonly identity: IdentityDirectory;
  readonly mediaPublicBaseUrls: readonly string[];
  readonly media?: MediaDirectory;
}
