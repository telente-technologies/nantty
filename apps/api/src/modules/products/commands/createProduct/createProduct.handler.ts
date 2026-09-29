import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import { createUniqueSlugFromText } from "../../../../utils/slug.util.js";
import { ProductUpdatedEvent } from "../../events/productUpdated.event.js";
import type { NewVariantInput, ProductWithVariants } from "../../models/products.model.js";
import type { ProductsService } from "../../services/products.service.js";
import type { CreateProductCommand } from "./createProduct.command.js";

export class CreateProductHandler extends CommandHandler<CreateProductCommand, ProductWithVariants> {
  public readonly commandType = "products.createProduct" as const;

  public constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async execute(command: CreateProductCommand): Promise<ProductWithVariants> {
    const { products, variants, stores, storeAccess, events } = this.productsService.dependencies;
    const { input } = command;
    await storeAccess.assertStoreMember(command.principal.userId, command.storeId);
    await this.productsService.assertCategoryExists(input.categoryId);
    const store = await stores.findById(command.storeId);
    if (store === undefined) throw notFound("Store");
    const product = await products.create({
      storeId: command.storeId,
      categoryId: input.categoryId ?? null,
      title: input.title.trim(),
      slug: createUniqueSlugFromText(input.title),
      description: input.description ?? "",
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? null,
      currency: store.currency,
      images: input.images ?? [],
      shippingInfo: input.shippingInfo ?? "",
      returnsInfo: input.returnsInfo ?? "",
    });
    const variantInputs: NewVariantInput[] = (input.variants ?? [{ stock: input.stock ?? 0 }]).map((variant) => ({
      sku: variant.sku ?? null,
      size: variant.size ?? null,
      color: variant.color ?? null,
      price: variant.price ?? input.price,
      stock: variant.stock,
    }));
    const createdVariants = await variants.createMany(product.id, variantInputs);
    await publishEvent(events, ProductUpdatedEvent, { productId: product.id, storeId: product.storeId });
    return { product, variants: createdVariants };
  }
}
