import type { CurrencyConverter } from "../interfaces/currencyConverter.interface.js";
import type { AuditRecorder } from "../interfaces/audit.interface.js";
import type { ProductCatalog } from "../interfaces/productCatalog.interface.js";
import type { StoreAccess } from "../interfaces/storeAccess.interface.js";
import type { UserDirectory } from "../interfaces/userDirectory.interface.js";
import { registerCategoriesCommandAndQueryHandlers } from "../modules/categories/categories.module.js";
import { CategoriesController } from "../modules/categories/controllers/categories.controller.js";
import { PrismaCategoriesRepository } from "../modules/categories/repositories/categories.prisma.repository.js";
import { InMemoryCategoriesRepository } from "../modules/categories/repositories/categories.repository.js";
import { CategoriesService } from "../modules/categories/services/categories.service.js";
import { ProductsController } from "../modules/products/controllers/products.controller.js";
import { registerProductsCommandAndQueryHandlers } from "../modules/products/products.module.js";
import { PrismaProductVariantsRepository } from "../modules/products/repositories/productVariants.prisma.repository.js";
import { InMemoryProductVariantsRepository } from "../modules/products/repositories/productVariants.repository.js";
import { PrismaProductsRepository } from "../modules/products/repositories/products.prisma.repository.js";
import { InMemoryProductsRepository } from "../modules/products/repositories/products.repository.js";
import { RepositoryProductCatalog } from "../modules/products/services/productCatalog.service.js";
import { PrismaProductEngagementRepository } from "../modules/products/repositories/productEngagement.prisma.repository.js";
import { InMemoryProductEngagementRepository } from "../modules/products/repositories/productEngagement.repository.js";
import { SellerProductsController } from "../modules/products/controllers/sellerProducts.controller.js";
import { ProductsService } from "../modules/products/services/products.service.js";
import { SearchController } from "../modules/search/controllers/search.controller.js";
import { registerSearchQueryHandlers } from "../modules/search/search.module.js";
import { SearchService } from "../modules/search/services/search.service.js";
import { SellerApplicationsController } from "../modules/stores/controllers/sellerApplications.controller.js";
import { StoresController } from "../modules/stores/controllers/stores.controller.js";
import { PrismaSellerApplicationsRepository } from "../modules/stores/repositories/sellerApplications.prisma.repository.js";
import { InMemorySellerApplicationsRepository } from "../modules/stores/repositories/sellerApplications.repository.js";
import { PrismaStoresRepository } from "../modules/stores/repositories/stores.prisma.repository.js";
import { InMemoryStoresRepository } from "../modules/stores/repositories/stores.repository.js";
import { StoreAccessService } from "../modules/stores/services/storeAccess.service.js";
import { StoresService } from "../modules/stores/services/stores.service.js";
import { registerStoresCommandAndQueryHandlers } from "../modules/stores/stores.module.js";
import type { Core } from "./core.loader.js";
import { createMediaModule, type MediaExternalServices } from "./media.loader.js";

export interface CatalogExternalServices extends MediaExternalServices {}

export interface CatalogSharedServices {
  readonly currencyConverter: CurrencyConverter;
  readonly audit: AuditRecorder;
  readonly userDirectory: UserDirectory;
}

export function createCatalogModules(core: Core, shared: CatalogSharedServices, external: CatalogExternalServices) {
  const usePrisma = core.persistence === "prisma";
  const { commands, queries, events } = core;
  const stores = usePrisma ? new PrismaStoresRepository() : new InMemoryStoresRepository();
  const applications = usePrisma ? new PrismaSellerApplicationsRepository() : new InMemorySellerApplicationsRepository();
  const categories = usePrisma ? new PrismaCategoriesRepository() : new InMemoryCategoriesRepository();
  const products = usePrisma ? new PrismaProductsRepository() : new InMemoryProductsRepository();
  const variants = usePrisma ? new PrismaProductVariantsRepository() : new InMemoryProductVariantsRepository();

  const storeAccess = new StoreAccessService(stores);
  const storesService = new StoresService({
    stores, applications, storeAccess, events,
    cipher: core.cipher,
    audit: shared.audit,
    userDirectory: shared.userDirectory,
    countPublishedProductsForStore: (storeId) => products.countPublishedForStore(storeId),
    countAllProductsForStore: (storeId) => products.countAllForStore(storeId),
  });
  registerStoresCommandAndQueryHandlers(commands, queries, storesService);

  registerCategoriesCommandAndQueryHandlers(commands, queries, new CategoriesService(categories, shared.audit));

  const engagement = usePrisma ? new PrismaProductEngagementRepository() : new InMemoryProductEngagementRepository();
  const productsService = new ProductsService({ products, variants, engagement, stores, categories, storeAccess, events, currencyConverter: shared.currencyConverter, audit: shared.audit });
  registerProductsCommandAndQueryHandlers(commands, queries, productsService);

  registerSearchQueryHandlers(queries, new SearchService(productsService, shared.userDirectory));

  const media = createMediaModule(core, external);

  const storeAccessPort: StoreAccess = storeAccess;
  const productCatalogPort: ProductCatalog = new RepositoryProductCatalog(productsService);
  return {
    storeAccess: storeAccessPort,
    productCatalog: productCatalogPort,
    mediaLibrary: media.mediaLibrary,
    mediaProcessingQueue: media.mediaProcessingQueue,
    scheduledJobs: media.scheduledJobs,
    controllers: {
      storesController: new StoresController(commands, queries, shared.currencyConverter),
      sellerApplicationsController: new SellerApplicationsController(commands, queries),
      categoriesController: new CategoriesController(commands, queries),
      productsController: new ProductsController(commands, queries, shared.currencyConverter),
      sellerProductsController: new SellerProductsController(commands, queries),
      searchController: new SearchController(queries, shared.currencyConverter),
      ...media.controllers,
    },
  };
}
