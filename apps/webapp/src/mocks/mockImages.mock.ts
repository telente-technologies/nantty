import { unsplashPhotoIds } from "./unsplashPhotoIds.mock";

export type DirectoryUserKey = keyof typeof unsplashPhotoIds.avatars;
export type CatalogProductKey = keyof typeof unsplashPhotoIds.products;
export type PostPhotoKey = keyof typeof unsplashPhotoIds.posts;
export type MartPhotoKey = keyof typeof unsplashPhotoIds.mart;

export const buildUnsplashImageUrl = (photoId: string, width: number) =>
  `https://images.unsplash.com/photo-${photoId}?w=${width}&q=80&fm=webp&fit=crop`;

export const avatarImageUrlForUser = (userKey: DirectoryUserKey) => buildUnsplashImageUrl(unsplashPhotoIds.avatars[userKey], 200);

export const coverImageUrlForUser = (userKey: DirectoryUserKey) => buildUnsplashImageUrl(unsplashPhotoIds.covers[userKey], 1200);

export const productImageUrlsForProduct = (productKey: CatalogProductKey): string[] =>
  unsplashPhotoIds.products[productKey].map((photoId) => buildUnsplashImageUrl(photoId, 800));

export const postImageUrlsForPhotoKey = (photoKey: PostPhotoKey): string[] =>
  unsplashPhotoIds.posts[photoKey].map((photoId) => buildUnsplashImageUrl(photoId, 1080));

export const martImageUrl = (martKey: MartPhotoKey, width = 800) => buildUnsplashImageUrl(unsplashPhotoIds.mart[martKey], width);
