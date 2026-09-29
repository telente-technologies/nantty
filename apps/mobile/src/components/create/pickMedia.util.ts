import * as ImagePicker from "expo-image-picker";

import type { LocalMediaFile } from "@/services/mediaPreparation.service";

export const MAXIMUM_MEDIA_PER_POST = 10;

const convertPickerAssetsToLocalMediaFiles = (assets: ImagePicker.ImagePickerAsset[]): LocalMediaFile[] =>
  assets.map((asset) => ({
    uri: asset.uri,
    mediaType: asset.type === "video" ? "video" : "image",
    mimeType: asset.mimeType ?? null,
    fileName: asset.fileName ?? null,
    sizeBytes: asset.fileSize ?? null,
    width: asset.width || null,
    height: asset.height || null,
    durationSeconds: asset.duration ? asset.duration / 1000 : null,
  }));

export async function pickPhotosAndVideosFromLibrary(maximumSelectionCount: number): Promise<LocalMediaFile[]> {
  if (maximumSelectionCount <= 0) return [];
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    allowsMultipleSelection: maximumSelectionCount > 1,
    selectionLimit: maximumSelectionCount,
    orderedSelection: true,
    quality: 1,
    exif: false,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  return result.canceled ? [] : convertPickerAssetsToLocalMediaFiles(result.assets.slice(0, maximumSelectionCount));
}

export async function takePhotoWithSystemCamera(): Promise<LocalMediaFile[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return [];
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images", "videos"], quality: 1, exif: false });
  return result.canceled ? [] : convertPickerAssetsToLocalMediaFiles(result.assets);
}
