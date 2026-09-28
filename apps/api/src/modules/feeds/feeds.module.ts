import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * feeds module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class FeedsModule extends BaseModule {
  public readonly id = "feeds";
  public readonly name = "feeds";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("feeds module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("feeds module stopped");
  }
}
