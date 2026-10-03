import type { Server } from "node:http";

import { createContainer } from "@zudojs/container";
import type { Module } from "@zudojs/core";
import { createEventBus } from "@zudojs/events";
import { createRuntime, type Runtime } from "@zudojs/runtime";

import type { AppConfig } from "./configs/index.js";
import { IntegrationsModule, integrations } from "./integrations/index.js";
import { createAppLogger } from "./loggers/index.js";
import { AuthModule } from "./modules/auth/index.js";
import { UsersModule } from "./modules/users/index.js";
import { StoresModule } from "./modules/stores/index.js";
import { CategoriesModule } from "./modules/categories/index.js";
import { ProductsModule } from "./modules/products/index.js";
import { CartsModule } from "./modules/carts/index.js";
import { OrdersModule } from "./modules/orders/index.js";
import { PaymentsModule } from "./modules/payments/index.js";
import { EscrowsModule } from "./modules/escrows/index.js";
import { WalletsModule } from "./modules/wallets/index.js";
import { PostsModule } from "./modules/posts/index.js";
import { FeedsModule } from "./modules/feeds/index.js";
import { FollowsModule } from "./modules/follows/index.js";
import { ReviewsModule } from "./modules/reviews/index.js";
import { NotificationsModule } from "./modules/notifications/index.js";
import { MessagesModule } from "./modules/messages/index.js";
import { ModerationModule } from "./modules/moderation/index.js";
import { SupportModule } from "./modules/support/index.js";
import { AutomationModule } from "./modules/automation/index.js";
import { SearchModule } from "./modules/search/index.js";
import { MediaModule } from "./modules/media/index.js";
import { WaitlistModule } from "./modules/waitlist/index.js";
import { CurrencyModule } from "./modules/currency/index.js";
import { AuditModule } from "./modules/index.js";

export interface AppOptions {
  readonly config: AppConfig;
  readonly httpServer?: Server;
}

export function createApp(options: AppOptions): Runtime {
  const logger = createAppLogger("zudomart");
  const container = createContainer();
  const eventBus = createEventBus();

  const modules = new Map<string, Module>();
  const integrationsModule = new IntegrationsModule(integrations, {
    config: options.config,
    ...(options.httpServer === undefined ? {} : { httpServer: options.httpServer }),
  });
  modules.set(integrationsModule.id, integrationsModule);
  for (const module of [
    new AuditModule(),
    new AuthModule(),
    new UsersModule(),
    new StoresModule(),
    new CategoriesModule(),
    new ProductsModule(),
    new CartsModule(),
    new OrdersModule(),
    new PaymentsModule(),
    new EscrowsModule(),
    new WalletsModule(),
    new PostsModule(),
    new FeedsModule(),
    new FollowsModule(),
    new ReviewsModule(),
    new NotificationsModule(),
    new MessagesModule(),
    new ModerationModule(),
    new SupportModule(),
    new AutomationModule(),
    new SearchModule(),
    new MediaModule(),
    new WaitlistModule(),
    new CurrencyModule(),
  ] as Module[]) {
    modules.set(module.id, module);
  }

  const runtime = createRuntime(
    { modules, logger, container, eventBus },
    {
      applicationName: "zudomart",
      applicationVersion: "0.1.0",
      environment: options.config.nodeEnv,
      handleSignals: false,
    },
  );

  runtime.registerReadinessCheck("modules", () => runtime.state === "running");

  return runtime;
}
