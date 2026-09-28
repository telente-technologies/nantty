import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * carts module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class CartsModule extends BaseModule {
  public readonly id = "carts";
  public readonly name = "carts";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("carts module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("carts module stopped");
  }
}
