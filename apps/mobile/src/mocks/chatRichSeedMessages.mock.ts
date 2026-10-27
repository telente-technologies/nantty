import type { Message } from "@/types";

import { lookupLinkPreview } from "./chatLinkPreviewLookup.mock";
import { productImageUrlsForProduct } from "./mockImages.mock";

const MEDIA_RETENTION_MS = 30 * 86_400_000;

type TextMessageBuilder = (id: string, conversationId: string, senderId: string, text: string, hoursAgo: number) => Message;

const withMediaExpiry = (message: Message): Message => ({ ...message, mediaExpiresAt: new Date(new Date(message.createdAt).getTime() + MEDIA_RETENTION_MS).toISOString() });

export const buildExpiredMediaSeedMessages = (conversationId: string, peerId: string, buildText: TextMessageBuilder): Message[] => [
  withMediaExpiry({
    ...buildText("m_exp_img", conversationId, peerId, "", 800),
    kind: "image",
    media: { id: "med_exp_1", type: "image", url: productImageUrlsForProduct("f1")[0] ?? null },
  }),
  withMediaExpiry({
    ...buildText("m_exp_voice", conversationId, peerId, "", 760),
    kind: "voice",
    media: { id: "med_exp_2", type: "voice", url: null, durationSeconds: 14 },
  }),
  buildText("m_exp_text", conversationId, "u_me", "Thanks for the voice note, I'll keep that in mind", 759),
];

const linkMessage = (buildText: TextMessageBuilder, id: string, conversationId: string, senderId: string, text: string, hoursAgo: number, url?: string): Message => ({
  ...buildText(id, conversationId, senderId, text, hoursAgo),
  linkPreview: url ? lookupLinkPreview(url) : null,
});

export const buildLinkSeedMessages = (conversationId: string, peerId: string, buildText: TextMessageBuilder): Message[] => [
  withMediaExpiry({
    ...buildText("m_fresh_img", conversationId, peerId, "", 7),
    kind: "image",
    media: { id: "med_fresh_1", type: "image", url: productImageUrlsForProduct("f2")[0] ?? null },
  }),
  linkMessage(buildText, "m_link_ext", conversationId, peerId, "Read this https://www.punchng.com/naira-and-the-market-this-week", 6, "https://www.punchng.com/naira-and-the-market-this-week"),
  linkMessage(buildText, "m_link_short", conversationId, "u_me", "Is this legit? https://bit.ly/3xYzAbC", 5.8, "https://bit.ly/3xYzAbC"),
  linkMessage(buildText, "m_link_prod", conversationId, peerId, "This one https://nantty.app/product/pr_f1", 5.5),
  linkMessage(buildText, "m_link_post", conversationId, peerId, "https://nantty.app/post/post_30", 5.2),
  linkMessage(buildText, "m_link_private", conversationId, peerId, "https://nantty.app/post/post_11", 5),
  linkMessage(buildText, "m_link_profile", conversationId, peerId, "Follow her https://nantty.app/u/u_3", 4.8),
  linkMessage(buildText, "m_link_live", conversationId, peerId, "Watching now https://nantty.app/live/live_s0", 4.5),
  linkMessage(buildText, "m_link_gone", conversationId, peerId, "https://nantty.app/product/pr_removed_item", 4.2),
];

