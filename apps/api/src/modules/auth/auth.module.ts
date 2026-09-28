import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * auth module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class AuthModule extends BaseModule {
  public readonly id = "auth";
  public readonly name = "auth";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("auth module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("auth module stopped");
  }
}
