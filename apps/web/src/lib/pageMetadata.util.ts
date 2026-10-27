import type { Metadata } from "next";

interface PublicPageMetadataInput {
  readonly title: string;
  readonly description: string;
  readonly path: string;
  readonly noIndex?: boolean;
}

/** Shared, complete search/social metadata for the public Nantty marketing site. */
export function createPublicPageMetadata({ title, description, path, noIndex = false }: PublicPageMetadataInput): Metadata {
  const pageTitle = `${title} | Nantty`;
  const image = { url: "/opengraph-image", width: 1200, height: 630, alt: `${title} — Nantty` };

  return {
    title,
    description,
    alternates: { canonical: path },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "en_NG",
      siteName: "Nantty",
      title: pageTitle,
      description,
      url: path,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
      images: [image.url],
    },
  };
}
