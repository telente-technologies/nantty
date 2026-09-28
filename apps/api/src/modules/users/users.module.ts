import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * users module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class UsersModule extends BaseModule {
  public readonly id = "users";
  public readonly name = "users";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("users module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("users module stopped");
  }
}
