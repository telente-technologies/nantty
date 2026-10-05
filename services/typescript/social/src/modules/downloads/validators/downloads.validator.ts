import { schema } from "@zudojs/schema";

export const postMediaDownloadParamsSchema = schema.object({ postId: schema.string().uuid(), mediaId: schema.string().uuid() });
export const downloadSettingsBodySchema = schema.object({ allowDownloads: schema.boolean() });
