import { defineEvent } from "@zudojs/events";

export interface StoreCreatedPayload {
  readonly storeId: string;
  readonly ownerId: string;
}

export const StoreCreatedEvent = defineEvent<"stores.storeCreated", StoreCreatedPayload>("stores.storeCreated");
