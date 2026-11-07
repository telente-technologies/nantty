import { useCallback, useState, type ReactNode } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";

import { MediaLightbox } from "@/components/feed/mediaLightbox";
import type { Media } from "@/types";

function buildPreviewMediaFromImageUrls(imageUrls: readonly (string | null | undefined)[]): Media[] {
  return imageUrls.filter((url): url is string => Boolean(url)).map((url) => ({ type: "image", url }));
}

export function useImagePreview() {
  const [previewState, setPreviewState] = useState<{ images: Media[]; initialIndex: number } | null>(null);

  const openImagePreview = useCallback((imageUrls: readonly (string | null | undefined)[], initialIndex = 0) => {
    const images = buildPreviewMediaFromImageUrls(imageUrls);
    if (images.length === 0) return;
    setPreviewState({ images, initialIndex: Math.min(Math.max(initialIndex, 0), images.length - 1) });
  }, []);

  const imagePreviewElement = previewState ? (
    <MediaLightbox images={previewState.images} initialIndex={previewState.initialIndex} visible onClose={() => setPreviewState(null)} />
  ) : null;

  return { openImagePreview, imagePreviewElement };
}

export interface PreviewableImageProps {
  readonly imageUrl: string | null | undefined;
  readonly galleryImageUrls?: readonly (string | null | undefined)[];
  readonly galleryIndex?: number;
  readonly accessibilityLabel: string;
  readonly onLongPress?: () => void;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}

export function PreviewableImage({ imageUrl, galleryImageUrls, galleryIndex = 0, accessibilityLabel, onLongPress, style, children }: PreviewableImageProps) {
  const { openImagePreview, imagePreviewElement } = useImagePreview();
  if (!imageUrl) return <>{children}</>;
  return (
    <>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Opens the image full screen"
        onPress={() => (galleryImageUrls ? openImagePreview(galleryImageUrls, galleryIndex) : openImagePreview([imageUrl]))}
        onLongPress={onLongPress}
        style={style}
      >
        {children}
      </Pressable>
      {imagePreviewElement}
    </>
  );
}
