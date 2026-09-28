import type { Server } from "node:http";

import { BaseModule, type ModuleContext } from "@zudojs/core";

import type { AppConfig } from "../configs/index.js";

export interface IntegrationContext {
  readonly config: AppConfig;
  readonly logger: ModuleContext["logger"];
  readonly httpServer?: Server;
}

export interface Integration {
  readonly name: string;
  start(context: IntegrationContext): Promise<void>;
  stop(): Promise<void>;
  drain?(): Promise<void>;
  health?(): Promise<boolean>;
}

export class IntegrationsModule extends BaseModule {
  public readonly id = "integrations";
  public readonly name = "integrations";
  private readonly started: Integration[] = [];

  public constructor(
    private readonly entries: readonly Integration[],
    private readonly startContext: Omit<IntegrationContext, "logger">,
  ) {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    for (const integration of this.entries) {
      await integration.start({ ...this.startContext, logger: context.logger });
      this.started.push(integration);
      context.logger.info(`${integration.name} started`);
    }
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    for (const integration of [...this.started].reverse()) {
      try {
        await integration.stop();
      } catch (error) {
        context.logger.error(`${integration.name} failed to stop`, { error });
      }
    }
    this.started.length = 0;
  }
}

export async function drainIntegrations(integrations: readonly Integration[]): Promise<void> {
  for (const integration of integrations) {
    await integration.drain?.().catch(() => undefined);
  }
}

export async function checkIntegrations(
  integrations: readonly Integration[],
): Promise<Record<string, "up" | "down">> {
  const checks: Record<string, "up" | "down"> = {};
  for (const integration of integrations) {
    if (integration.health === undefined) continue;
    const healthy = await integration.health().catch(() => false);
    checks[integration.name] = healthy ? "up" : "down";
  }
  return checks;
}
