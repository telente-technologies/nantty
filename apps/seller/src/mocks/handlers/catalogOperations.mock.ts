import { registerCategoryAndSupplierMockRoutes } from "@/mocks/handlers/categoryAndSupplierRoutes.mock";
import { registerInventoryInsightMockRoutes } from "@/mocks/handlers/inventoryInsightRoutes.mock";

export function registerCatalogOperationsMockHandlers(): void {
  registerCategoryAndSupplierMockRoutes();
  registerInventoryInsightMockRoutes();
}
