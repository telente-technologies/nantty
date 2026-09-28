import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * audit module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class AuditModule extends BaseModule {
  public readonly id = "audit";
  public readonly name = "audit";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("audit module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("audit module stopped");
  }
}
