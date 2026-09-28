import type { Command, CommandBus, CommandHandler, Query, QueryBus, QueryHandler } from "@zudojs/cqrs";

export function registerCommandHandlers(bus: CommandBus, handlers: readonly CommandHandler<Command, unknown>[]): void {
  for (const handler of handlers) bus.register(handler.commandType, handler);
}

export function registerQueryHandlers(bus: QueryBus, handlers: readonly QueryHandler<Query, unknown>[]): void {
  for (const handler of handlers) bus.register(handler.queryType, handler);
}
