import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * search module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class SearchModule extends BaseModule {
  public readonly id = "search";
  public readonly name = "search";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("search module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("search module stopped");
  }
}
