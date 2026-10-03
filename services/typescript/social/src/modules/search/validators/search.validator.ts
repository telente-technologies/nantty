import { schema } from "@zudojs/schema";

export const searchPeopleQuerySchema = schema.object({ q: schema.string().min(1).max(100), cursor: schema.string().max(100).optional(), limit: schema.coerce.number().int().min(1).max(50).optional() });
