import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * posts module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class PostsModule extends BaseModule {
  public readonly id = "posts";
  public readonly name = "posts";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("posts module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("posts module stopped");
  }
}
