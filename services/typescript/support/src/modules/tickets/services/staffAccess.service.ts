import type { HttpRouterContext } from "@zudojs/http";

import type { Clock } from "../../../interfaces/clock.interface.js";
import type { TicketStore } from "../../../interfaces/ticketStore.interface.js";
import { requireAnyStaffPermission, staffHoldsAnyPermission, type StaffAuthenticator, type StaffPrincipal } from "../../../middlewares/staffAuth.middleware.js";

export interface StaffAccess {
  require(context: HttpRouterContext, permissions: readonly string[]): Promise<StaffPrincipal>;
}

export function createStaffAccess(authenticator: StaffAuthenticator, store: TicketStore, clock: Clock): StaffAccess {
  return {
    async require(context, permissions) {
      const staff = await authenticator.authenticate(context);
      requireAnyStaffPermission(staff, permissions);
      if (staffHoldsAnyPermission(staff, ["support:tickets", "support:chat"])) await store.recordAgentSeen({ staffId: staff.id, name: staff.name }, clock.now()).catch(() => undefined);
      return staff;
    },
  };
}
