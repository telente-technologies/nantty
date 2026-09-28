import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * wallets module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class WalletsModule extends BaseModule {
  public readonly id = "wallets";
  public readonly name = "wallets";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("wallets module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("wallets module stopped");
  }
}
