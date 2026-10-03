import type { LinkPreview } from "@/types";

import { martImageUrl } from "./mockImages.mock";

type KnownLinkPreview = Pick<LinkPreview, "title" | "description" | "imageUrl">;

const KNOWN_LINK_PREVIEWS: Readonly<Record<string, KnownLinkPreview>> = {
  "jumia.com.ng": { title: "Jumia Nigeria: Online Shopping for Phones, Fashion & More", description: "Shop online with fast delivery and pay on delivery across Nigeria.", imageUrl: martImageUrl("heroBanner", 600) },
  "punchng.com": { title: "Punch Newspapers: Breaking news from Nigeria", description: "Latest headlines on politics, business, sports and entertainment.", imageUrl: martImageUrl("newArrivals", 600) },
  "github.com": { title: "GitHub: Where the world builds software", description: "Millions of developers and companies build and ship software on GitHub.", imageUrl: null },
  "youtube.com": { title: "YouTube", description: "Enjoy the videos and music you love.", imageUrl: martImageUrl("featuredBrands", 600) },
  "wikipedia.org": { title: "Wikipedia, the free encyclopedia", description: "Wikipedia is a free online encyclopedia written by volunteers.", imageUrl: null },
};

const readHostname = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export const lookupLinkPreview = (url: string): LinkPreview => {
  const domain = readHostname(url);
  const knownKey = Object.keys(KNOWN_LINK_PREVIEWS).find((key) => domain === key || domain.endsWith(`.${key}`));
  const known = knownKey ? KNOWN_LINK_PREVIEWS[knownKey] : null;
  return { url, domain, title: known?.title ?? domain, description: known?.description ?? null, imageUrl: known?.imageUrl ?? null };
};
