import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { VariantOfProduct } from "../../models/products.model.js";
import type { ProductsService } from "../../services/products.service.js";
import type { UpdateProductVariantCommand } from "./updateProductVariant.command.js";

export class UpdateProductVariantHandler extends CommandHandler<UpdateProductVariantCommand, VariantOfProduct> {
  public readonly commandType = "products.updateProductVariant" as const;

  public constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async execute(command: UpdateProductVariantCommand): Promise<VariantOfProduct> {
    const product = await this.productsService.findStoreProductForMember(command.principal.userId, command.storeId, command.productId);
    await this.productsService.findVariantOfProduct(product.id, command.variantId);
    const updated = await this.productsService.dependencies.variants.update(command.variantId, { ...command.changes });
    if (updated === undefined) throw notFound("Product variant");
    return { product, variant: updated };
  }
}
