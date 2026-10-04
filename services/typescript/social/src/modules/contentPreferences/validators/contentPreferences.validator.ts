import { schema } from "@zudojs/schema";

export const updateContentPreferencesBodySchema = schema.object({ showSensitiveWithoutWarning: schema.boolean() });
