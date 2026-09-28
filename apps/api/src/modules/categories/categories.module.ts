import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * categories module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class CategoriesModule extends BaseModule {
  public readonly id = "categories";
  public readonly name = "categories";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("categories module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("categories module stopped");
  }
}
