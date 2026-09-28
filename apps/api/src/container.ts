import { createToken } from "@zudojs/container";

import type { HealthCheck } from "./routes/health.routes.js";
// zudojs:container-imports:start
// zudojs:container-imports:end

/**
 * The token server.ts registers the composition root under in the runtime
 * container, so a module can reach it:
 * `context.application.container.resolve(APP_DEPENDENCIES)`.
 */
export const APP_DEPENDENCIES = createToken<AppDependencies>("app.dependencies");

/** Options for {@link createDependencies}. */
export interface DependencyOptions {
  /** Readiness for /health; server.ts passes the runtime's. */
  readonly health?: HealthCheck;
}

/**
 * The composition root: every controller, service and repository is
 * constructed here, once. `zudojs generate resource` adds entries between
 * the markers; swap an implementation (e.g. a database repository) here.
 */
export function createDependencies(options: DependencyOptions = {}) {
  const health: HealthCheck =
    options.health ?? (async () => ({ ready: true, checks: {} }));

  return {
    health,
    // zudojs:container:start
    // zudojs:container:end
  };
}

/** Everything route registration receives. */
export type AppDependencies = ReturnType<typeof createDependencies>;
