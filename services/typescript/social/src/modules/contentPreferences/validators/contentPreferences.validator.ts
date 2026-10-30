import { schema } from "@nantty/fastify-platform";

export const updateContentPreferencesBodySchema = schema.object({ showSensitiveWithoutWarning: schema.boolean() });
