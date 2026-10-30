import { schema } from "@nantty/fastify-platform";

export const searchPlacesQuerySchema = schema.object({ q: schema.string().max(120) });
