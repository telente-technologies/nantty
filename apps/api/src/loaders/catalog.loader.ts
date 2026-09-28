import type { AuditRecorder } from "../interfaces/audit.interface.js";
import type { ProductCatalog } from "../interfaces/productCatalog.interface.js";
import type { StoreAccess } from "../interfaces/storeAccess.interface.js";
import type { UserDirectory } from "../interfaces/userDirectory.interface.js";
import type { Core } from "./core.loader.js";
import { createPlaceholderPort } from "./placeholder.loader.js";

export interface CatalogExternalServices {}

export interface CatalogSharedServices {
  readonly audit: AuditRecorder;
  readonly userDirectory: UserDirectory;
}

export function createCatalogModules(core: Core, shared: CatalogSharedServices, external: CatalogExternalServices) {
  void core;
  void shared;
  void external;
  return {
    storeAccess: createPlaceholderPort<StoreAccess>("storeAccess"),
    productCatalog: createPlaceholderPort<ProductCatalog>("productCatalog"),
    controllers: {},
  };
}
