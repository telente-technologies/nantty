import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * media module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class MediaModule extends BaseModule {
  public readonly id = "media";
  public readonly name = "media";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("media module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("media module stopped");
  }
}
