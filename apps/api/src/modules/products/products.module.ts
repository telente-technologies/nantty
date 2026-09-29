import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { AddProductVariantHandler } from "./commands/addProductVariant/addProductVariant.handler.js";
import { AdjustInventoryHandler } from "./commands/adjustInventory/adjustInventory.handler.js";
import { CreateProductHandler } from "./commands/createProduct/createProduct.handler.js";
import { DeleteProductHandler } from "./commands/deleteProduct/deleteProduct.handler.js";
import { PublishProductHandler } from "./commands/publishProduct/publishProduct.handler.js";
import { UnpublishProductHandler } from "./commands/unpublishProduct/unpublishProduct.handler.js";
import { UpdateProductHandler } from "./commands/updateProduct/updateProduct.handler.js";
import { UpdateProductVariantHandler } from "./commands/updateProductVariant/updateProductVariant.handler.js";
import { GetMartHomeHandler } from "./queries/getMartHome/getMartHome.handler.js";
import { GetProductHandler } from "./queries/getProduct/getProduct.handler.js";
import { ListProductsHandler } from "./queries/listProducts/listProducts.handler.js";
import { ListStoreInventoryHandler } from "./queries/listStoreInventory/listStoreInventory.handler.js";
import { ListStoreProductsHandler } from "./queries/listStoreProducts/listStoreProducts.handler.js";
import type { ProductsService } from "./services/products.service.js";

export class ProductsModule extends BaseModule {
  public readonly id = "products";
  public readonly name = "products";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("products module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("products module stopped");
  }
}

export function registerProductsCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, productsService: ProductsService): void {
  registerCommandHandlers(commands, [
    new CreateProductHandler(productsService),
    new UpdateProductHandler(productsService),
    new DeleteProductHandler(productsService),
    new PublishProductHandler(productsService),
    new UnpublishProductHandler(productsService),
    new AddProductVariantHandler(productsService),
    new UpdateProductVariantHandler(productsService),
    new AdjustInventoryHandler(productsService),
  ]);
  registerQueryHandlers(queries, [
    new GetProductHandler(productsService),
    new ListProductsHandler(productsService),
    new ListStoreProductsHandler(productsService),
    new ListStoreInventoryHandler(productsService),
    new GetMartHomeHandler(productsService),
  ]);
}
