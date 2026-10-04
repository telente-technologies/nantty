import { readMockDatabase, type MockAdAccountRecord } from "@/mocks/mockDatabase.mock";
import { demoIdentitiesByAccountId } from "@/mocks/seed/demoContent.mock";
import type { Creative, CreativeInput, CreativeMedia } from "@/types/creative.type";

export function resolveCreativeFromInput(input: CreativeInput, account: MockAdAccountRecord): Creative {
  const database = readMockDatabase();
  const source = input.source.type === "upload" ? null : database.contentSources.find((candidate) => candidate.id === input.source.id && candidate.accountId === account.id);
  const uploadedMedia = input.mediaIds.map((mediaId) => database.media.get(mediaId)?.media).filter((media): media is CreativeMedia => Boolean(media));
  const identity = demoIdentitiesByAccountId[account.id] ?? {
    name: account.business?.storeName ?? account.name,
    handle: account.business?.handle ?? account.name.toLowerCase().replace(/[^a-z0-9]+/g, "."),
    avatarUrl: account.business?.logoUrl ?? null,
    verifiedBusiness: account.kind === "business" && Boolean(account.business?.goldVerified),
  };
  const cards = input.cards.map((card) => ({
    media: database.media.get(card.mediaId)?.media ?? { id: card.mediaId, kind: "image" as const, url: "", posterUrl: null, width: 1, height: 1, durationSeconds: null },
    headline: card.headline,
    description: card.description,
    callToAction: card.callToAction,
    destination: card.destination,
  }));
  const iconUrl = input.app?.iconMediaId ? database.media.get(input.app.iconMediaId)?.media.url : undefined;
  return {
    type: input.type,
    mediaClickable: input.mediaClickable,
    cards,
    app: input.app ? { ...input.app, ...(iconUrl ? { iconUrl } : {}) } : null,
    format: input.format,
    source: input.source,
    media: uploadedMedia.length > 0 ? uploadedMedia : source?.media ?? [],
    headline: input.headline,
    primaryText: input.primaryText,
    callToAction: input.callToAction,
    destination: input.destination,
    identity,
    product: source?.product ?? null,
    live: source?.live ?? null,
  };
}
