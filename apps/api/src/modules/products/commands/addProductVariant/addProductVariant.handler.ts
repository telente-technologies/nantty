import { CommandHandler } from "@zudojs/cqrs";

import type { VariantOfProduct } from "../../models/products.model.js";
import type { ProductsService } from "../../services/products.service.js";
import type { AddProductVariantCommand } from "./addProductVariant.command.js";

export class AddProductVariantHandler extends CommandHandler<AddProductVariantCommand, VariantOfProduct> {
  public readonly commandType = "products.addProductVariant" as const;

  public constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async execute(command: AddProductVariantCommand): Promise<VariantOfProduct> {
    const product = await this.productsService.findStoreProductForMember(command.principal.userId, command.storeId, command.productId);
    const [variant] = await this.productsService.dependencies.variants.createMany(product.id, [{
      sku: command.input.sku ?? null,
      size: command.input.size ?? null,
      color: command.input.color ?? null,
      price: command.input.price ?? product.price,
      stock: command.input.stock,
    }]);
    if (variant === undefined) throw new Error("The variant could not be created.");
    return { product, variant: variant };
  }
}
