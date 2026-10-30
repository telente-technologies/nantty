import { schema } from "@nantty/fastify-platform";

export const resolveLinkPreviewQuerySchema = schema.object({ url: schema.string().min(10).max(2048).regex(/^https?:\/\//i) });
export const postLinkPreviewParamsSchema = schema.object({ postId: schema.string().uuid() });
