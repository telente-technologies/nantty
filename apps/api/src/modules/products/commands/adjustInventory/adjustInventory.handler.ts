import { CommandHandler } from "@zudojs/cqrs";

import { unprocessable } from "../../../../errors/domain.error.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import { InventoryAdjustedEvent } from "../../events/inventoryAdjusted.event.js";
import type { VariantOfProduct } from "../../models/products.model.js";
import type { ProductsService } from "../../services/products.service.js";
import type { AdjustInventoryCommand } from "./adjustInventory.command.js";

export class AdjustInventoryHandler extends CommandHandler<AdjustInventoryCommand, VariantOfProduct> {
  public readonly commandType = "products.adjustInventory" as const;

  public constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async execute(command: AdjustInventoryCommand): Promise<VariantOfProduct> {
    const { variants, events } = this.productsService.dependencies;
    const product = await this.productsService.findStoreProductForMember(command.principal.userId, command.storeId, command.productId);
    await this.productsService.findVariantOfProduct(product.id, command.variantId);
    const adjusted = await variants.adjustStockBy(command.variantId, command.delta);
    if (adjusted === undefined) throw unprocessable("Stock cannot go below zero.");
    await publishEvent(events, InventoryAdjustedEvent, { productId: product.id, variantId: adjusted.id, stock: adjusted.stock });
    return { product, variant: adjusted };
  }
}
