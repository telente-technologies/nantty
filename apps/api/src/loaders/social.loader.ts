import type { AuditRecorder } from "../interfaces/audit.interface.js";
import type { OrderLookup } from "../interfaces/orderLookup.interface.js";
import type { ProductCatalog } from "../interfaces/productCatalog.interface.js";
import type { SocialGraph } from "../interfaces/socialGraph.interface.js";
import type { StoreAccess } from "../interfaces/storeAccess.interface.js";
import type { UserDirectory } from "../interfaces/userDirectory.interface.js";
import type { Core } from "./core.loader.js";
import { createPlaceholderPort } from "./placeholder.loader.js";

export interface SocialSharedServices {
  readonly audit: AuditRecorder;
  readonly userDirectory: UserDirectory;
  readonly storeAccess: StoreAccess;
  readonly productCatalog: ProductCatalog;
  readonly orderLookup: OrderLookup;
}

export function createSocialModules(core: Core, shared: SocialSharedServices) {
  void core;
  void shared;
  return {
    socialGraph: createPlaceholderPort<SocialGraph>("socialGraph"),
    controllers: {},
  };
}
