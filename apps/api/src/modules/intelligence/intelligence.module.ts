import { BaseModule, type ModuleContext } from "@zudojs/core";

export class IntelligenceModule extends BaseModule {
  public readonly id = "intelligence";
  public readonly name = "intelligence";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("intelligence module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("intelligence module stopped");
  }
}
