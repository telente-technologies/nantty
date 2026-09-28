import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * reviews module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class ReviewsModule extends BaseModule {
  public readonly id = "reviews";
  public readonly name = "reviews";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("reviews module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("reviews module stopped");
  }
}
