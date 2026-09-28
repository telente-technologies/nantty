import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * messages module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class MessagesModule extends BaseModule {
  public readonly id = "messages";
  public readonly name = "messages";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("messages module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("messages module stopped");
  }
}
