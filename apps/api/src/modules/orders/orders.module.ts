import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * orders module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class OrdersModule extends BaseModule {
  public readonly id = "orders";
  public readonly name = "orders";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("orders module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("orders module stopped");
  }
}
