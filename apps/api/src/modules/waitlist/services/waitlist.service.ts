import type { EventBus } from "@zudojs/events";

import type { Clock } from "../../../interfaces/clock.interface.js";
import type { WaitlistRepository } from "../repositories/waitlist.repository.js";

export interface WaitlistDependencies {
  readonly entries: WaitlistRepository;
  readonly events: EventBus;
  readonly clock: Clock;
}

export class WaitlistService {
  public constructor(public readonly dependencies: WaitlistDependencies) {}
}
