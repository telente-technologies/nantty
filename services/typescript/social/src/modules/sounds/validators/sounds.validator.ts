import { schema } from "@zudojs/schema";

export const soundParamsSchema = schema.object({ soundId: schema.string().uuid() });
export const listSoundsQuerySchema = schema.object({ q: schema.string().max(80).optional(), cursor: schema.string().uuid().optional(), limit: schema.coerce.number().int().min(1).max(50).optional() });
export const createSoundBodySchema = schema.object({
  title: schema.string().min(1).max(100), audioUrl: schema.string().max(2000).optional(), coverUrl: schema.string().max(2000).optional(),
  sourceClipId: schema.string().uuid().optional(), allowReuse: schema.boolean().optional(),
});
export const updateSoundBodySchema = schema.object({ title: schema.string().min(1).max(100).optional(), allowReuse: schema.boolean().optional() });
