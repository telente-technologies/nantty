import { Image, type ImageProps } from "expo-image";

export type CachedImageProps = ImageProps;

export function CachedImage({ cachePolicy = "memory-disk", ...imageProps }: CachedImageProps) {
  return <Image cachePolicy={cachePolicy} {...imageProps} />;
}

export function prefetchImagesToDiskCache(imageUrls: readonly (string | null | undefined)[]) {
  const downloadableImageUrls = imageUrls.filter((url): url is string => typeof url === "string" && /^https?:\/\//.test(url));
  if (downloadableImageUrls.length === 0) return Promise.resolve(true);
  return Image.prefetch(downloadableImageUrls, "memory-disk").catch(() => false);
}
