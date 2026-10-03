import { registerInventoryStockMockRoutes } from "@/mocks/handlers/inventoryStock.mock";
import { registerMediaUploadMockRoutes } from "@/mocks/handlers/mediaUploads.mock";
import { registerProductCatalogMockRoutes } from "@/mocks/handlers/productCatalogRoutes.mock";
import { registerProductExtraMockRoutes } from "@/mocks/handlers/productExtraRoutes.mock";
import { registerProductImportExportMockRoutes } from "@/mocks/handlers/productImportExport.mock";

export function registerCatalogMockHandlers(): void {
  registerProductImportExportMockRoutes();
  registerProductExtraMockRoutes();
  registerProductCatalogMockRoutes();
  registerInventoryStockMockRoutes();
  registerMediaUploadMockRoutes();
}
