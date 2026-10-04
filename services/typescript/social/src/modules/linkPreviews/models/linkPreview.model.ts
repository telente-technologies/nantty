export interface LinkPreviewView {
  readonly url: string;
  readonly domain: string;
  readonly title: string;
  readonly description: string | null;
  readonly siteName: string | null;
  readonly imageUrl: string | null;
  readonly imageMediaId: string | null;
}

export interface ParsedLinkMetadata {
  readonly title: string | null;
  readonly description: string | null;
  readonly siteName: string | null;
  readonly imageUrl: string | null;
  readonly oembedUrl: string | null;
}
