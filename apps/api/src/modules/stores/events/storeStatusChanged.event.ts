import { defineEvent } from "@zudojs/events";

export interface StoreStatusChangedPayload {
  readonly storeId: string;
  readonly status: "active" | "suspended";
}

export const StoreStatusChangedEvent = defineEvent<"stores.storeStatusChanged", StoreStatusChangedPayload>("stores.storeStatusChanged");
