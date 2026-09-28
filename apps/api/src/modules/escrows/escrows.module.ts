import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * escrows module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class EscrowsModule extends BaseModule {
  public readonly id = "escrows";
  public readonly name = "escrows";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("escrows module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("escrows module stopped");
  }
}
