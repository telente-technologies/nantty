import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * payments module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class PaymentsModule extends BaseModule {
  public readonly id = "payments";
  public readonly name = "payments";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("payments module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("payments module stopped");
  }
}
