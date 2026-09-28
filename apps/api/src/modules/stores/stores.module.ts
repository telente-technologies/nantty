import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * stores module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class StoresModule extends BaseModule {
  public readonly id = "stores";
  public readonly name = "stores";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("stores module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("stores module stopped");
  }
}
