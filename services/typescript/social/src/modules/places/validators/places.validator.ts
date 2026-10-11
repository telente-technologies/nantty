import { schema } from "@zudojs/schema";

export const searchPlacesQuerySchema = schema.object({ q: schema.string().max(120) });
