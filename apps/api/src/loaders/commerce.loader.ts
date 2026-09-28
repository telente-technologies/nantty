import type { AuditRecorder } from "../interfaces/audit.interface.js";
import type { OrderLookup } from "../interfaces/orderLookup.interface.js";
import type { ProductCatalog } from "../interfaces/productCatalog.interface.js";
import type { StoreAccess } from "../interfaces/storeAccess.interface.js";
import type { UserDirectory } from "../interfaces/userDirectory.interface.js";
import type { Core } from "./core.loader.js";
import { createPlaceholderPort } from "./placeholder.loader.js";

export interface CommerceExternalServices {}

export interface CommerceSharedServices {
  readonly audit: AuditRecorder;
  readonly userDirectory: UserDirectory;
  readonly storeAccess: StoreAccess;
  readonly productCatalog: ProductCatalog;
}

export function createCommerceModules(core: Core, shared: CommerceSharedServices, external: CommerceExternalServices) {
  void core;
  void shared;
  void external;
  return {
    orderLookup: createPlaceholderPort<OrderLookup>("orderLookup"),
    scheduledJobs: [] as readonly { readonly id: string; readonly every: string; readonly run: () => Promise<void> }[],
    controllers: {},
  };
}
