import { schema } from "@nantty/fastify-platform";

import type { Handler } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { CreateChannelCommand } from "../commands/createChannel/createChannel.command.js";
import type { ChannelSubscriptionCommand } from "../commands/subscribeToChannel/subscribeToChannel.command.js";
import type { ConversationView } from "../models/conversation.model.js";

const createChannelBodySchema = schema.object({
  name: schema.string().min(1).max(80),
  description: schema.string().max(500).optional(),
  photoMediaId: schema.string().uuid().optional(),
});
const channelParamsSchema = schema.object({ channelId: schema.string().uuid() });

export interface ChannelsHandlers {
  readonly createChannel: Handler<CreateChannelCommand, ConversationView>;
  readonly subscribeToChannel: Handler<ChannelSubscriptionCommand, ConversationView>;
  readonly unsubscribeFromChannel: Handler<ChannelSubscriptionCommand, void>;
}

export function createChannelsController(route: RouteFactory, handlers: ChannelsHandlers) {
  return {
    create: route({ authentication: "required", body: createChannelBodySchema, successStatus: 201 }, ({ principal, body }) =>
      handlers.createChannel({ ownerId: principal.accountId, name: body.name, description: body.description, photoMediaId: body.photoMediaId })),
    subscribe: route({ authentication: "required", params: channelParamsSchema }, ({ principal, params }) => handlers.subscribeToChannel({ viewerId: principal.accountId, channelId: params.channelId })),
    unsubscribe: route({ authentication: "required", params: channelParamsSchema }, ({ principal, params }) => handlers.unsubscribeFromChannel({ viewerId: principal.accountId, channelId: params.channelId })),
  };
}
