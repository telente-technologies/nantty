import type { EventBus, EventDefinition } from "@zudojs/events";

export function subscribeToEvent<TType extends string, TPayload>(
  events: EventBus,
  definition: EventDefinition<TType, TPayload>,
  handler: (payload: TPayload) => Promise<void> | void,
): void {
  events.on(definition.type, async (event) => {
    await handler(event.payload as TPayload);
  });
}

export async function publishEvent<TType extends string, TPayload>(
  events: EventBus,
  definition: EventDefinition<TType, TPayload>,
  payload: NoInfer<TPayload>,
): Promise<void> {
  await events.publish(definition.create(payload));
}
