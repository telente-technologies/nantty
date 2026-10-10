import * as ImagePicker from "expo-image-picker";

import type { LocalMediaFile } from "@/services/media/mediaPreparation.service";

export const MAXIMUM_MEDIA_PER_POST = 10;
const CLIP_RECORDING_MAXIMUM_SECONDS = 180;

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

async function pickFromLibrary(mediaTypes: ImagePicker.MediaType[], maximumSelectionCount: number): Promise<LocalMediaFile[]> {
  if (maximumSelectionCount <= 0) return [];
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes,
    allowsMultipleSelection: maximumSelectionCount > 1,
    selectionLimit: maximumSelectionCount,
    orderedSelection: true,
    quality: 1,
    exif: false,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  return result.canceled ? [] : convertPickerAssetsToLocalMediaFiles(result.assets.slice(0, maximumSelectionCount));
}

async function captureWithCamera(mediaTypes: ImagePicker.MediaType[], videoMaxDuration?: number): Promise<LocalMediaFile[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return [];
  const result = await ImagePicker.launchCameraAsync({ mediaTypes, quality: 1, exif: false, ...(videoMaxDuration ? { videoMaxDuration } : {}) });
  return result.canceled ? [] : convertPickerAssetsToLocalMediaFiles(result.assets);
}

export const pickPhotosAndVideosFromLibrary = (maximumSelectionCount: number) => pickFromLibrary(["images", "videos"], maximumSelectionCount);

export const pickOneVideoFromLibrary = () => pickFromLibrary(["videos"], 1);

export const pickPhotosFromLibrary = (maximumSelectionCount: number) => pickFromLibrary(["images"], maximumSelectionCount);

export const takePhotoWithSystemCamera = () => captureWithCamera(["images", "videos"]);

export const recordClipVideoWithSystemCamera = () => captureWithCamera(["videos"], CLIP_RECORDING_MAXIMUM_SECONDS);
