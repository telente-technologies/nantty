import type { CategorySource, PostSource, SoundSource } from "../../../interfaces/sourceHydrator.interface.js";
import type { DocumentVisibility, SearchDocument } from "../../../types/searchDocument.type.js";
import { normalizeHashtag } from "../../../utils/queryNormalizer.util.js";

const maximumHashtagsPerDocument = 30;

export function extractHashtags(caption: string, declared: readonly string[]): string[] {
  const fromCaption = [...caption.matchAll(/#([\p{L}\p{N}_]{1,64})/gu)].map((match) => match[1] ?? "");
  const unique = new Set([...declared, ...fromCaption].map(normalizeHashtag).filter((tag) => tag !== ""));
  return [...unique].slice(0, maximumHashtagsPerDocument);
}

export function resolvePostVisibility(source: PostSource): DocumentVisibility {
  if (source.removed || source.kind === "story" || source.visibility === "subscribers") return "hidden";
  return source.audience === "followers" ? "followers" : "public";
}

export function buildPostDocument(source: PostSource, version: number): SearchDocument | null {
  if (source.kind === "story") return null;
  const visibility = resolvePostVisibility(source);
  const tags = extractHashtags(source.caption, source.hashtags);
  return {
    kind: source.kind,
    entityId: source.postId,
    ownerAccountId: source.authorId,
    title: source.caption.slice(0, 120),
    subtitle: source.soundTitle,
    body: source.caption,
    tags,
    summary: { id: source.postId, authorId: source.authorId, kind: source.kind, caption: source.caption, thumbnailUrl: source.thumbnailUrl, likes: source.likeCount, views: source.viewCount, hashtags: tags },
    visibility,
    available: visibility !== "hidden",
    popularity: source.likeCount + source.viewCount / 10,
    region: null,
    version,
    createdAt: source.createdAt,
  };
}

export function buildCategoryDocument(source: CategorySource, version: number): SearchDocument {
  return {
    kind: "category",
    entityId: source.categoryId,
    ownerAccountId: null,
    title: source.name,
    subtitle: source.path.join(" > "),
    body: source.synonyms.join(" "),
    tags: source.synonyms.map(normalizeHashtag),
    summary: { id: source.categoryId, name: source.name, path: source.path },
    visibility: "public",
    available: source.active,
    popularity: 0,
    region: null,
    version,
    createdAt: source.createdAt,
  };
}

export function buildSoundDocument(source: SoundSource, version: number): SearchDocument {
  return {
    kind: "sound",
    entityId: source.soundId,
    ownerAccountId: null,
    title: source.title,
    subtitle: source.artist,
    body: "",
    tags: [],
    summary: { id: source.soundId, title: source.title, artist: source.artist, coverUrl: source.coverUrl, uses: source.useCount },
    visibility: "public",
    available: source.active,
    popularity: source.useCount,
    region: null,
    version,
    createdAt: source.createdAt,
  };
}
