import { schema } from "@nantty/fastify-platform";

export const postMediaDownloadParamsSchema = schema.object({ postId: schema.string().uuid(), mediaId: schema.string().uuid() });
export const downloadSettingsBodySchema = schema.object({ allowDownloads: schema.boolean() });
