import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * products module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
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
