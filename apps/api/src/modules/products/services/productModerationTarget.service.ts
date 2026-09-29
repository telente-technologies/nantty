import type { ModerationTargetGateway } from "../../../interfaces/moderationTargets.interface.js";
import type { ProductsService } from "./products.service.js";

export function createProductModerationTarget(productsService: ProductsService): ModerationTargetGateway {
  const { products, storeAccess } = productsService.dependencies;
  return {
    targetType: "product",
    describeTarget: async (productId) => {
      const product = await products.findById(productId);
      if (product === undefined) return undefined;
      const [store] = await storeAccess.findStoreSummaries([product.storeId]);
      return store === undefined ? undefined : { ownerUserId: store.ownerId, summary: product.title };
    },
    applyContentAction: async (productId, action, decidedAt) => {
      const product = await products.findById(productId);
      if (product === undefined) return false;
      if (action === "restore") return (await products.updateStatus(productId, "published", product.publishedAt ?? decidedAt)) !== undefined;
      return (await products.updateStatus(productId, "archived", product.publishedAt)) !== undefined;
    },
  };
}
