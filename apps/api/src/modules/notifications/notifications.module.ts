import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * notifications module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class NotificationsModule extends BaseModule {
  public readonly id = "notifications";
  public readonly name = "notifications";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("notifications module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("notifications module stopped");
  }
}
