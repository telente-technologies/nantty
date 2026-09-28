import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * follows module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class FollowsModule extends BaseModule {
  public readonly id = "follows";
  public readonly name = "follows";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("follows module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("follows module stopped");
  }
}
