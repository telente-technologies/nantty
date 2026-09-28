import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * waitlist module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class WaitlistModule extends BaseModule {
  public readonly id = "waitlist";
  public readonly name = "waitlist";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("waitlist module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("waitlist module stopped");
  }
}
